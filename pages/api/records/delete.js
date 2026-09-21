import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = new Set(['leads', 'tasks', 'calls', 'followups', 'appointments', 'reservations', 'deals', 'deal_payments']);
const ALLOWED_ROLES = new Set(['admin', 'manager', 'ceo', 'finance', 'team_leader', 'sales']);

function getClient(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { table, id, lead_id: leadId } = req.body || {};
  if (!ALLOWED_TABLES.has(table) || !id) {
    return res.status(400).json({ error: 'Invalid table or record id' });
  }

  const supabase = getClient(token);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: 'Invalid session' });

  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (roleError) return res.status(500).json({ error: roleError.message });

  const role = String(roleRow?.role || 'sales').toLowerCase().replace(/\s+/g, '_');
  if (!ALLOWED_ROLES.has(role)) return res.status(403).json({ error: 'Insufficient permissions' });

  let query = supabase.from(table).delete().eq('id', id);
  if (leadId && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) {
    query = query.eq('lead_id', leadId);
  }

  const { error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ ok: true, table, id });
}
