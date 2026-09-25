import { createClient } from '@supabase/supabase-js';

const MAX_TEXT = 500;

function text(value, max = MAX_TEXT) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizePhone(value) {
  return String(value ?? '').replace(/[^0-9]/g, '');
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function dbClient(key, accessToken = '') {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken
      ? { headers: { Authorization: 'Bearer ' + accessToken } }
      : undefined,
  });
}

async function authorize(req, adminClient) {
  const ingestSecret = process.env.ARCOVA_LEAD_INGEST_SECRET;
  const suppliedSecret = String(req.headers['x-arcova-ingest-secret'] || '');
  if (ingestSecret && suppliedSecret && suppliedSecret === ingestSecret) {
    return { kind: 'integration', user: null, role: 'integration' };
  }

  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return null;

  const publicClient = dbClient(anonKey);
  const { data, error } = await publicClient.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role,active')
    .eq('id', data.user.id)
    .single();

  if (!roleRow?.active || !roleRow?.role) return null;

  const role = String(roleRow.role).trim().toLowerCase().replace(/\s+/g, '_');
  const { data: permission } = await adminClient
    .from('app_role_permissions')
    .select('permission_key')
    .eq('role_key', role)
    .eq('permission_key', 'leads.create')
    .maybeSingle();

  if (!permission) return null;
  return { kind: 'user', user: data.user, role, accessToken: token };
}

async function canAssignLead(adminClient, actor, assignedTo) {
  if (!assignedTo || actor.kind === 'integration') return true;
  if (assignedTo === actor.user.id) return true;

  if (['admin', 'ceo', 'manager'].includes(actor.role)) return true;
  if (actor.role !== 'team_leader') return false;

  const [{ data: caller }, { data: target }] = await Promise.all([
    adminClient.from('profiles').select('id,team_id').eq('id', actor.user.id).maybeSingle(),
    adminClient.from('profiles').select('id,team_id,team_leader_id').eq('id', assignedTo).maybeSingle(),
  ]);

  if (!target) return false;
  return Boolean(
    target.team_leader_id === actor.user.id ||
    (caller?.team_id && target.team_id && caller.team_id === target.team_id)
  );
}

async function findDuplicate(adminClient, { phone, email, externalSource, externalLeadId }) {
  if (externalSource && externalLeadId) {
    const { data } = await adminClient
      .from('leads')
      .select('id')
      .eq('external_source', externalSource)
      .eq('external_lead_id', externalLeadId)
      .limit(1);
    if (data?.length) return data[0];
  }

  const phoneNormalized = normalizePhone(phone);
  if (phoneNormalized) {
    const { data } = await adminClient
      .from('leads')
      .select('id')
      .eq('phone_normalized', phoneNormalized)
      .limit(1);
    if (data?.length) return data[0];
  }

  const emailNormalized = normalizeEmail(email);
  if (emailNormalized) {
    const { data } = await adminClient
      .from('leads')
      .select('id')
      .eq('email_normalized', emailNormalized)
      .limit(1);
    if (data?.length) return data[0];
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return res.status(500).json({ error: 'Lead ingestion is not configured.' });
  }

  const adminClient = dbClient(serviceRoleKey);
  const actor = await authorize(req, adminClient);
  if (!actor) return res.status(401).json({ error: 'Unauthorized lead ingestion request.' });

  try {
    const body = req.body || {};
    const name = text(body.name, 200);
    const phone = text(body.phone, 60);
    const email = normalizeEmail(body.email);
    const externalSource = text(body.external_source || body.lead_source, 100) || null;
    const externalLeadId = text(body.external_lead_id || body.leadgen_id, 200) || null;

    if (!name || !normalizePhone(phone)) {
      return res.status(400).json({ error: 'A valid name and phone are required.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const duplicate = await findDuplicate(adminClient, {
      phone,
      email,
      externalSource,
      externalLeadId,
    });
    if (duplicate) {
      return res.status(409).json({ error: 'Duplicate lead.', lead_id: duplicate.id });
    }

    const budgetValue = body.budget === '' || body.budget == null ? null : Number(body.budget);
    if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0)) {
      return res.status(400).json({ error: 'Invalid budget.' });
    }

    const requestedAssignee = text(body.assigned_to, 100) || null;
    if (actor.kind === 'user' && !(await canAssignLead(adminClient, actor, requestedAssignee))) {
      return res.status(403).json({ error: 'You cannot assign a lead outside your permitted scope.' });
    }

    const assignedTo = actor.kind === 'user'
      ? (requestedAssignee || (['admin', 'ceo', 'manager'].includes(actor.role) ? null : actor.user.id))
      : requestedAssignee;

    const lead = {
      name,
      phone,
      email: email || null,
      lead_source: text(body.lead_source, 100) || 'API',
      status: 'New Lead',
      assigned_to: assignedTo,
      folder: text(body.folder, 150) || null,
      desired_unit_type: text(body.desired_unit_type, 150) || null,
      budget: budgetValue,
      preferred_location: text(body.preferred_location, 200) || null,
      preferred_area: text(body.preferred_area, 200) || null,
      external_source: externalSource,
      external_lead_id: externalLeadId,
      campaign_id: text(body.campaign_id, 100) || null,
    };

    // User-originated writes go through the caller token so Supabase RLS remains
    // the final enforcement layer. Only the explicit integration path may use
    // the service-role client to bypass RLS.
    const writeClient = actor.kind === 'user'
      ? dbClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, actor.accessToken)
      : adminClient;

    const { data, error } = await writeClient
      .from('leads')
      .insert([lead])
      .select('id,name,phone,email,lead_source,status,assigned_to,created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Duplicate lead.' });
      }
      return res.status(400).json({ error: 'Lead could not be created.' });
    }

    if (actor.kind === 'user' && actor.user?.id) {
      await adminClient.from('audit_logs').insert([{
        user_id: actor.user.id,
        action: 'CREATE_LEAD_API',
        table_name: 'leads',
        details: { lead_id: data.id, source: lead.lead_source, assigned_to: lead.assigned_to },
      }]);
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Lead ingestion error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
