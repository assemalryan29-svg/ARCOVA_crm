import { createClient } from '@supabase/supabase-js';

const TABLES = new Set([
  'leads',
  'tasks',
  'calls',
  'followups',
  'appointments',
  'reservations',
  'deals',
  'deal_payments',
]);

const ARCHIVE_STATUS = Object.freeze({
  leads: 'Archived',
  tasks: 'Archived',
  calls: 'Cancelled',
  followups: 'Cancelled',
  appointments: 'Cancelled',
  deal_payments: 'Cancelled',
  deals: 'Cancelled',
});

const PERMISSION_BY_TABLE = Object.freeze({
  leads: 'leads.update',
  tasks: 'tasks.manage',
  calls: 'calls.manage',
  followups: 'followups.manage',
  appointments: 'appointments.manage',
  reservations: 'reservations.manage',
  deals: 'deals.manage',
  deal_payments: 'finance.manage',
});

const PERMANENT_DELETE_TABLES = new Set([
  'leads',
  'tasks',
  'calls',
  'followups',
  'appointments',
]);

const PERMANENT_DELETE_ROLES = new Set(['admin']);

function getClient(key, token = '') {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    key,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token ? { headers: { Authorization: 'Bearer ' + token } } : undefined,
    },
  );
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

async function hasPermission(supabase, role, permissionKey) {
  const { data, error } = await supabase
    .from('app_role_permissions')
    .select('permission_key')
    .eq('role_key', role)
    .eq('permission_key', permissionKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function callReservationRelease(supabase, reservationId) {
  const { data, error } = await supabase.rpc('release_reservation_atomic', {
    p_reservation_id: reservationId,
    p_new_status: 'Cancelled',
  });
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { table, id, lead_id: leadId, mode = 'archive' } = req.body || {};
  if (!TABLES.has(table) || !id) return res.status(400).json({ error: 'Invalid table or record id' });
  if (!['archive', 'permanent'].includes(mode)) return res.status(400).json({ error: 'Invalid deletion mode' });

  const supabase = getClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, token);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: 'Invalid session' });

  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role,active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (roleError) return res.status(500).json({ error: roleError.message });
  if (!roleRow?.active || !roleRow?.role) return res.status(403).json({ error: 'User account is inactive or has no configured role.' });

  const role = normalizeRole(roleRow.role);
  const permissionKey = PERMISSION_BY_TABLE[table];
  if (!(await hasPermission(supabase, role, permissionKey))) {
    return res.status(403).json({ error: 'You do not have permission for this record.' });
  }

  if (mode === 'permanent') {
    if (!PERMANENT_DELETE_ROLES.has(role) || !PERMANENT_DELETE_TABLES.has(table)) {
      return res.status(403).json({ error: 'Permanent deletion is restricted to Admin and non-financial operational records.' });
    }

    let query = supabase.from(table).delete().eq('id', id);
    if (table === 'leads') query = query.eq('id', id);
    const { data, error } = await query.select('id');
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: 'Record not found or access denied.' });

    await supabase.from('audit_logs').insert([{
      user_id: authData.user.id,
      action: 'PERMANENT_DELETE',
      table_name: table,
      details: { record_id: id, role },
    }]);

    return res.status(200).json({ ok: true, table, id, mode, action: 'PERMANENT_DELETE' });
  }

  if (table === 'reservations') {
    try {
      await callReservationRelease(supabase, id);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Reservation cancellation was rejected.' });
    }
  } else {
    const status = ARCHIVE_STATUS[table];
    if (!status) return res.status(400).json({ error: 'Safe archive is not supported for this record type.' });

    let query = supabase.from(table).update({ status }).eq('id', id);
    if (leadId && ['calls', 'followups', 'appointments', 'reservations', 'deals'].includes(table)) {
      query = query.eq('lead_id', leadId);
    }

    // A Won deal is already financially finalized; do not silently cancel it.
    if (table === 'deals') query = query.neq('status', 'Won');

    const { data, error } = await query.select('id,status').maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Record not found, already finalized, or access denied.' });
  }

  await supabase.from('audit_logs').insert([{
    user_id: authData.user.id,
    action: table === 'reservations' ? 'RESERVATION_CANCELLED' : 'ARCHIVE',
    table_name: table,
    details: { record_id: id, mode, role },
  }]);

  return res.status(200).json({ ok: true, table, id, mode, action: table === 'reservations' ? 'RESERVATION_CANCELLED' : 'ARCHIVE' });
}
