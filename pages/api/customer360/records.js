import { createClient } from '@supabase/supabase-js';

const TABLES = new Set(['calls', 'followups', 'appointments', 'reservations', 'deals', 'deal_payments']);
const PERMISSION_BY_TABLE = Object.freeze({
  calls: 'calls.manage',
  followups: 'followups.manage',
  appointments: 'appointments.manage',
  reservations: 'reservations.manage',
  deals: 'deals.manage',
  deal_payments: 'finance.manage',
});

const INSERT_FIELDS = Object.freeze({
  calls: ['lead_id', 'assigned_to', 'call_at', 'duration_seconds', 'outcome', 'notes'],
  followups: ['lead_id', 'assigned_to', 'followup_date', 'type', 'status', 'notes'],
  appointments: ['lead_id', 'assigned_to', 'scheduled_at', 'type', 'status', 'notes'],
  reservations: ['lead_id', 'unit_id', 'sales_person', 'reservation_amount', 'contract_value', 'status', 'expires_at', 'notes'],
  deals: ['lead_id', 'unit_id', 'sales_person', 'deal_value', 'down_payment', 'installment_months', 'payment_frequency', 'status', 'contract_date', 'notes'],
  deal_payments: ['deal_id', 'installment_no', 'due_date', 'amount', 'paid_at', 'status', 'notes'],
});

const UPDATE_FIELDS = Object.freeze({
  calls: ['call_at', 'duration_seconds', 'outcome', 'notes'],
  followups: ['followup_date', 'type', 'status', 'notes'],
  appointments: ['scheduled_at', 'type', 'status', 'notes'],
  reservations: ['reservation_amount', 'contract_value', 'status', 'expires_at', 'notes', 'unit_id'],
  deals: ['deal_value', 'down_payment', 'installment_months', 'payment_frequency', 'status', 'contract_date', 'notes', 'unit_id', 'reservation_id'],
  deal_payments: ['installment_no', 'due_date', 'amount', 'status', 'paid_at', 'notes'],
});

function serverClient(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

function roleFrom(value) {
  return String(value || 'sales').toLowerCase().replace(/\s+/g, '_');
}

function pick(source, fields) {
  return Object.fromEntries(
    Object.entries(source || {}).filter(([key]) => fields.includes(key)),
  );
}

async function authorize(supabase, userId, table) {
  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role,active')
    .eq('id', userId)
    .maybeSingle();
  if (roleError) throw new Error(roleError.message);
  if (!roleRow?.active) return { allowed: false, status: 403, error: 'User account is inactive.' };

  const role = roleFrom(roleRow.role);
  const permissionKey = PERMISSION_BY_TABLE[table];
  const { data: permission, error: permissionError } = await supabase
    .from('app_role_permissions')
    .select('permission_key')
    .eq('role_key', role)
    .eq('permission_key', permissionKey)
    .maybeSingle();

  if (permissionError) throw new Error(permissionError.message);
  if (!permission) return { allowed: false, status: 403, error: 'You do not have permission for this record type.' };

  return { allowed: true, role };
}

export default async function handler(req, res) {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { table, id, lead_id: leadId } = req.body || {};
  if (!TABLES.has(table)) return res.status(400).json({ error: 'Invalid table' });
  if (req.method !== 'POST' && !id) return res.status(400).json({ error: 'Record id is required' });

  const supabase = serverClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

  let auth;
  try {
    auth = await authorize(supabase, userData.user.id, table);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to verify permissions.' });
  }
  if (!auth.allowed) return res.status(auth.status).json({ error: auth.error });

  // This endpoint performs a physical DELETE. Keep it Admin-only so the
  // Customer360 path cannot silently bypass the safer archive/permanent-delete policy.
  if (req.method === 'DELETE' && auth.role !== 'admin') {
    return res.status(403).json({ error: 'Permanent deletion is restricted to Admin.' });
  }

  if (req.method === 'DELETE') {
    let query = supabase.from(table).delete().eq('id', id);
    if (leadId && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) {
      query = query.eq('lead_id', leadId);
    }
    const { data, error } = await query.select('id');
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: 'Record not found or access denied.' });

    await supabase.from('audit_logs').insert([{
      user_id: userData.user.id,
      action: `${table.toUpperCase()}_PERMANENT_DELETE`,
      table_name: table,
      details: { record_id: id, lead_id: leadId || null, role: auth.role },
    }]);

    return res.status(200).json({ ok: true, data: data[0] });
  }

  if (req.method === 'PATCH') {
    const patch = pick(req.body?.patch, UPDATE_FIELDS[table]);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No editable fields supplied' });

    let query = supabase.from(table).update(patch).eq('id', id);
    if (leadId && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) {
      query = query.eq('lead_id', leadId);
    }
    const { data, error } = await query.select().single();
    if (error) return res.status(400).json({ error: error.message });

    await supabase.from('audit_logs').insert([{
      user_id: userData.user.id,
      action: `${table.toUpperCase()}_UPDATED`,
      table_name: table,
      details: { record_id: id, lead_id: leadId || null, role: auth.role, fields: Object.keys(patch) },
    }]);

    return res.status(200).json({ data });
  }

  const input = pick(req.body?.record ?? req.body?.patch, INSERT_FIELDS[table]);
  if (['calls', 'followups', 'appointments'].includes(table)) {
    input.assigned_to = input.assigned_to || userData.user.id;
  }
  if (['reservations', 'deals'].includes(table)) {
    input.sales_person = input.sales_person || userData.user.id;
  }
  if (leadId && !input.lead_id && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) {
    input.lead_id = leadId;
  }

  if (!Object.keys(input).length) return res.status(400).json({ error: 'No record fields supplied' });

  const { data, error } = await supabase
    .from(table)
    .insert([input])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabase.from('audit_logs').insert([{
    user_id: userData.user.id,
    action: `${table.toUpperCase()}_CREATED`,
    table_name: table,
    details: { record_id: data.id, lead_id: data.lead_id || leadId || null, role: auth.role },
  }]);

  return res.status(201).json({ data });
}
