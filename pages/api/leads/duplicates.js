import { createClient } from '@supabase/supabase-js';

const MAX_GROUPS = 200;
const MAX_MERGE_SIZE = 25;

function client(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeRole(value) {
  return String(value || 'sales').trim().toLowerCase().replace(/\s+/g, '_');
}

async function authenticate(req, adminClient) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Missing authorization token.', status: 401 };

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return { error: 'Server is not configured.', status: 500 };

  const publicClient = client(anonKey);
  const { data, error } = await publicClient.auth.getUser(token);
  if (error || !data?.user) return { error: 'Invalid session.', status: 401 };

  const { data: roleRow, error: roleError } = await adminClient
    .from('user_roles')
    .select('role,active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (roleError) return { error: 'Unable to verify user role.', status: 500 };

  const role = normalizeRole(roleRow?.role);
  if (!roleRow?.active) return { error: 'User account is inactive.', status: 403 };
  if (role !== 'admin') return { error: 'Lead duplicate management is restricted to Admin.', status: 403 };

  return { userId: data.user.id, role };
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server is not configured.' });
  }

  const adminClient = client(serviceRoleKey);
  const auth = await authenticate(req, adminClient);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  if (req.method === 'GET') {
    const { data: groups, error: groupsError } = await adminClient
      .from('lead_duplicate_groups')
      .select('identity_key,identity_type,duplicate_count,lead_ids,first_seen_at,last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(MAX_GROUPS);

    if (groupsError) return res.status(500).json({ error: groupsError.message });

    const ids = uniqueIds((groups || []).flatMap((group) => group.lead_ids || []));
    if (!ids.length) return res.status(200).json({ groups: [], total_groups: 0 });

    const { data: leads, error: leadsError } = await adminClient
      .from('leads')
      .select('id,name,phone,email,lead_source,status,temperature,next_follow_up,budget,preferred_area,preferred_location,desired_unit_type,assigned_to,project_id,created_at,updated_at')
      .in('id', ids);

    if (leadsError) return res.status(500).json({ error: leadsError.message });

    const leadMap = new Map((leads || []).map((lead) => [lead.id, lead]));
    const enriched = (groups || []).map((group) => ({
      ...group,
      leads: (group.lead_ids || []).map((id) => leadMap.get(id)).filter(Boolean),
    }));

    return res.status(200).json({
      groups: enriched,
      total_groups: enriched.length,
    });
  }

  const body = req.body || {};
  if (body.confirm !== true) {
    return res.status(400).json({ error: 'Explicit confirmation is required before merging leads.' });
  }

  const primaryId = String(body.primary_id || '').trim();
  const duplicateIds = uniqueIds(body.duplicate_ids).filter((id) => id !== primaryId);

  if (!primaryId || !duplicateIds.length) {
    return res.status(400).json({ error: 'Primary lead and at least one duplicate lead are required.' });
  }
  if (duplicateIds.length > MAX_MERGE_SIZE - 1) {
    return res.status(400).json({ error: `A single merge is limited to ${MAX_MERGE_SIZE} leads.` });
  }

  const selectedIds = [primaryId, ...duplicateIds];
  const { data: selectedLeads, error: selectedError } = await adminClient
    .from('leads')
    .select('id,name,phone,email,phone_normalized,email_normalized,status,assigned_to,created_at')
    .in('id', selectedIds);

  if (selectedError) return res.status(500).json({ error: selectedError.message });
  if ((selectedLeads || []).length !== selectedIds.length) {
    return res.status(404).json({ error: 'One or more selected leads were not found.' });
  }

  const primary = selectedLeads.find((lead) => lead.id === primaryId);
  const duplicates = selectedLeads.filter((lead) => lead.id !== primaryId);

  const primaryPhone = String(primary.phone_normalized || '').trim();
  const primaryEmail = String(primary.email_normalized || '').trim();
  const samePhone = Boolean(primaryPhone) && duplicates.every((lead) => lead.phone_normalized === primaryPhone);
  const sameEmail = Boolean(primaryEmail) && duplicates.every((lead) => lead.email_normalized === primaryEmail);

  if (!samePhone && !sameEmail) {
    return res.status(400).json({ error: 'Selected leads do not share the same normalized phone or email identity.' });
  }

  const { data, error } = await adminClient.rpc('merge_leads_atomic', {
    p_primary_lead_id: primaryId,
    p_duplicate_lead_ids: duplicateIds,
    p_actor_user_id: auth.userId,
  });

  if (error) {
    console.error('Lead merge error:', error);
    return res.status(400).json({ error: error.message || 'Lead merge failed.' });
  }

  return res.status(200).json({
    ok: true,
    result: data,
  });
}
