import { createClient } from '@supabase/supabase-js';

const ALLOWED_TABLES = new Set([
  'leads',
  'tasks',
  'calls',
  'followups',
  'appointments',
  'reservations',
  'deals',
  'deal_payments',
]);

const ALLOWED_ROLES = new Set([
  'admin',
  'manager',
  'ceo',
  'finance',
  'team_leader',
  'sales',
  'marketing',
  'operations',
  'support',
]);

const ARCHIVE_STATUS = new Set([
  'leads',
  'tasks',
  'calls',
  'followups',
  'appointments',
  'reservations',
  'deals',
]);

function getClient(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

function normalizeRole(value) {
  return String(value || 'sales').toLowerCase().replace(/\s+/g, '_');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { table, id, lead_id: leadId, mode = 'archive' } = req.body || {};
  if (!ALLOWED_TABLES.has(table) || !id) {
    return res.status(400).json({ error: 'Invalid table or record id' });
  }
  if (!['archive', 'permanent'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid deletion mode' });
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

  const role = normalizeRole(roleRow?.role);
  if (!ALLOWED_ROLES.has(role)) return res.status(403).json({ error: 'Insufficient permissions' });
  if (mode === 'permanent' && role !== 'admin') {
    return res.status(403).json({ error: 'Permanent deletion is restricted to Admin.' });
  }

  let query;
  let action;

  if (mode === 'archive') {
    if (!ARCHIVE_STATUS.has(table)) {
      return res.status(400).json({
        error: 'This record type does not support safe archive yet. Permanent deletion is Admin-only.',
      });
    }

    query = supabase.from(table).update({ status: 'Archived' }).eq('id', id);
    action = 'ARCHIVE';
  } else {
    query = supabase.from(table).delete().eq('id', id);
    action = 'PERMANENT_DELETE';
  }

  if (leadId && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) {
    query = query.eq('lead_id', leadId);
  }

  const { data: changedRows, error } = await query.select('id');
  if (error) return res.status(400).json({ error: error.message });
  if (!changedRows?.length) {
    return res.status(404).json({ error: 'Record not found or access denied.' });
  }

  // Audit logging is best-effort so a logging-schema difference cannot undo the record action.
  await supabase.from('audit_logs').insert([{
    user_id: authData.user.id,
    user_email: authData.user.email,
    action,
    details: `${action} ${table}:${id}`,
  }]);

  return res.status(200).json({ ok: true, table, id, mode, action });
}
