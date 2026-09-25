import { createClient } from '@supabase/supabase-js';

function client(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizePhone(value) {
  return String(value ?? '').replace(/[^0-9]/g, '');
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || 'sales').toLowerCase().replace(/\s+/g, '_');
}

export default async function handler(req, res) {
  if (!['PATCH', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'PATCH, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: 'Server is not configured.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  const adminClient = client(serviceRoleKey);
  const publicClient = client(anonKey);
  const { data: authData, error: authError } = await publicClient.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: 'Invalid session.' });

  const userId = authData.user.id;
  const { data: roleRow, error: roleError } = await adminClient
    .from('user_roles')
    .select('role,active')
    .eq('id', userId)
    .maybeSingle();
  if (roleError) return res.status(500).json({ error: 'Unable to verify user role.' });

  if (!roleRow?.active || !roleRow?.role) {
    return res.status(403).json({ error: 'User account is inactive or has no configured role.' });
  }
  const role = normalizeRole(roleRow.role);

  const { data: permission } = await adminClient
    .from('app_role_permissions')
    .select('permission_key')
    .eq('role_key', role)
    .eq('permission_key', 'leads.update')
    .maybeSingle();
  if (!permission) return res.status(403).json({ error: 'This role cannot edit leads.' });

  const body = req.body || {};
  const id = text(body.id, 100);
  const name = text(body.name, 200);
  const phone = text(body.phone, 60);
  const email = normalizeEmail(body.email);
  if (!id || !name || !normalizePhone(phone)) {
    return res.status(400).json({ error: 'Name, phone and record id are required.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const budget = body.budget === '' || body.budget == null ? null : Number(body.budget);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
    return res.status(400).json({ error: 'Invalid budget.' });
  }

  const allowedStatuses = new Set(['New Lead', 'Contacted', 'Interested', 'Meeting Set', 'Closed Won', 'Lost', 'Archived']);
  const allowedTemperatures = new Set(['Cold', 'Warm', 'Hot']);
  const status = body.status == null || body.status === '' ? undefined : text(body.status, 40);
  const temperature = body.temperature == null || body.temperature === '' ? undefined : text(body.temperature, 20);

  if (status !== undefined && !allowedStatuses.has(status)) {
    return res.status(400).json({ error: 'Invalid lead status.' });
  }
  if (temperature !== undefined && !allowedTemperatures.has(temperature)) {
    return res.status(400).json({ error: 'Invalid lead temperature.' });
  }

  const { data: existingLead, error: existingError } = await adminClient
    .from('leads')
    .select('id,assigned_to')
    .eq('id', id)
    .maybeSingle();
  if (existingError) return res.status(400).json({ error: existingError.message });
  if (!existingLead) return res.status(404).json({ error: 'Lead not found.' });

  const elevated = ['admin', 'ceo', 'manager'].includes(role);
  let canEdit = elevated || existingLead.assigned_to === userId;

  if (!canEdit && role === 'team_leader' && existingLead.assigned_to) {
    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('id,team_leader_id,team_id')
      .eq('id', existingLead.assigned_to)
      .maybeSingle();

    if (targetProfileError) return res.status(500).json({ error: 'Unable to verify team access.' });

    if (targetProfile?.team_leader_id === userId) {
      canEdit = true;
    } else if (targetProfile?.team_id) {
      const { data: callerProfile, error: callerProfileError } = await adminClient
        .from('profiles')
        .select('team_id')
        .eq('id', userId)
        .maybeSingle();

      if (callerProfileError) return res.status(500).json({ error: 'Unable to verify team access.' });
      canEdit = Boolean(callerProfile?.team_id && callerProfile.team_id === targetProfile.team_id);
    }
  }

  if (!canEdit) {
    return res.status(403).json({ error: 'You can edit only leads within your permitted scope.' });
  }

  const updates = {
    name,
    phone,
    email: email || null,
    lead_source: text(body.lead_source, 100) || null,
    budget,
    preferred_area: text(body.preferred_area, 200) || null,
    preferred_location: text(body.preferred_location, 200) || null,
    desired_unit_type: text(body.desired_unit_type, 150) || null,
    folder: text(body.folder, 150) || null,
    campaign_id: text(body.campaign_id, 100) || null,
    ...(status !== undefined ? { status } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
  };

  // Perform the actual write with the caller's token so Supabase RLS
  // remains the final enforcement layer after the API-level scope check.
  const { data, error } = await publicClient
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select('id,name,phone,email,lead_source,budget,preferred_area,preferred_location,desired_unit_type,folder,campaign_id,status,assigned_to,updated_at')
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Lead could not be updated.' });

  await adminClient.from('audit_logs').insert([{
    user_id: userId,
    action: 'UPDATE_LEAD_API',
    table_name: 'leads',
    details: { lead_id: id, role },
  }]);

  return res.status(200).json({ success: true, data, lead: data });
}
