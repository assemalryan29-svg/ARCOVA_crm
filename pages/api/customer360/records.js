import { createClient } from '@supabase/supabase-js';

const TABLES = new Set(['calls', 'followups', 'appointments', 'reservations', 'deals', 'deal_payments']);
const WRITE_ROLES = new Set(['admin', 'manager', 'ceo', 'finance', 'team_leader', 'sales']);

function serverClient(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

export default async function handler(req, res) {
  if (!['PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { table, id, lead_id: leadId } = req.body || {};
  if (!TABLES.has(table) || !id) return res.status(400).json({ error: 'Invalid table or record id' });

  const supabase = serverClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session' });

  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (roleError) return res.status(500).json({ error: roleError.message });

  const role = String(roleRow?.role || 'sales').toLowerCase().replace(/\s+/g, '_');
  if (!WRITE_ROLES.has(role)) return res.status(403).json({ error: 'Insufficient permissions' });

  if (req.method === 'DELETE') {
    let query = supabase.from(table).delete().eq('id', id);
    if (leadId && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) query = query.eq('lead_id', leadId);
    const { error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  const allowed = {
    calls: ['call_at', 'duration_seconds', 'outcome', 'notes', 'status'],
    followups: ['followup_date', 'type', 'status', 'notes'],
    appointments: ['scheduled_at', 'type', 'status', 'notes'],
    reservations: ['reservation_amount', 'contract_value', 'status', 'expires_at', 'notes', 'unit_id'],
    deals: ['deal_value', 'down_payment', 'installment_months', 'payment_frequency', 'status', 'contract_date', 'notes', 'unit_id', 'reservation_id'],
    deal_payments: ['installment_no', 'due_date', 'amount', 'status', 'paid_at', 'notes'],
  };
  const source = req.body?.patch || {};
  const patch = Object.fromEntries(Object.entries(source).filter(([key]) => allowed[table].includes(key)));
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'No editable fields supplied' });

  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ data });
}
