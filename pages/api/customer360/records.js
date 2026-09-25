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
  if (!roleRow?.active || !roleRow?.role) {
    return { allowed: false, status: 403, error: 'User account is inactive or has no configured role.' };
  }

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

  if (req.method === 'DELETE') {
    if (['reservations', 'deals', 'deal_payments'].includes(table)) {
      return res.status(400).json({ error: 'Use the protected sales/finance workflow for this record type.' });
    }
    let query = supabase.from(table).delete().eq('id', id);
    if (leadId && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) {
      query = query.eq('lead_id', leadId);
    }
    const { data, error } = await query.select('id');
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: 'Record not found or access denied.' });

    await supabase.from('audit_logs').insert([{
      user_id: userData.user.id,
      action: `${table.toUpperCase()}_DELETED`,
      table_name: table,
      details: { record_id: id, lead_id: leadId || null, role: auth.role },
    }]);

    return res.status(200).json({ ok: true, data: data[0] });
  }

  if (req.method === 'PATCH') {
    if (table === 'deal_payments' && req.body?.patch?.status === 'Paid') {
      const { data, error } = await supabase.rpc('record_deal_payment', {
        p_payment_id: id,
        p_paid_at: req.body?.patch?.paid_at ? new Date(req.body.patch.paid_at).toISOString() : new Date().toISOString(),
        p_notes: req.body?.patch?.notes || null
      });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (['reservations', 'deals', 'deal_payments'].includes(table)) {
      return res.status(400).json({ error: 'Use the protected sales/finance workflow for this record type.' });
    }

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

  const rawInput = req.body?.record ?? req.body?.patch ?? {};

  if (table === 'reservations') {
    const { data, error } = await supabase.rpc('reserve_unit_atomic', {
      p_lead_id: leadId || rawInput.lead_id || null,
      p_unit_id: rawInput.unit_id || null,
      p_reservation_amount: Number(rawInput.reservation_amount || 0),
      p_contract_value: rawInput.contract_value === '' || rawInput.contract_value == null ? null : Number(rawInput.contract_value),
      p_expires_at: rawInput.expires_at ? new Date(rawInput.expires_at).toISOString() : null,
      p_notes: rawInput.notes || null
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ data, workflow: 'reserve_unit_atomic' });
  }

  if (table === 'deals') {
    if (!rawInput.reservation_id) {
      return res.status(400).json({ error: 'A reservation is required before creating a deal.' });
    }
    const { data, error } = await supabase.rpc('confirm_reservation_as_deal', {
      p_reservation_id: rawInput.reservation_id,
      p_deal_value: Number(rawInput.deal_value || 0),
      p_down_payment: Number(rawInput.down_payment || 0),
      p_installment_months: rawInput.installment_months ? Number(rawInput.installment_months) : null,
      p_payment_frequency: rawInput.payment_frequency || 'monthly',
      p_contract_date: rawInput.contract_date || new Date().toISOString().slice(0, 10),
      p_commission: Number(rawInput.commission || 0),
      p_notes: rawInput.notes || null
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ data, workflow: 'confirm_reservation_as_deal' });
  }

  if (table === 'deal_payments') {
    const { data, error } = await supabase.rpc('generate_deal_payment_schedule', {
      p_deal_id: rawInput.deal_id || null,
      p_first_due_date: rawInput.first_due_date || new Date().toISOString().slice(0, 10)
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ data: { generated_installments: Number(data || 0) }, workflow: 'generate_deal_payment_schedule' });
  }

  const input = pick(rawInput, INSERT_FIELDS[table]);
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
