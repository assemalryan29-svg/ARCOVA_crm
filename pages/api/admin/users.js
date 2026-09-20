import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server-side Supabase keys are not configured.' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing access token.' });

    const publicClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await publicClient.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session.' });

    const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: callerRole, error: roleError } = await adminClient.from('user_roles').select('role,active').eq('id', userData.user.id).single();
    if (roleError || !callerRole?.active || !['admin','ceo'].includes(String(callerRole.role || '').toLowerCase())) {
      return res.status(403).json({ error: 'Only Admin or CEO can create users.' });
    }

    const { email, password, role = 'sales', full_name = '' } = req.body || {};
    const normalizedRole = String(role).trim().toLowerCase();
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const { data: roleCheck } = await adminClient.from('app_roles').select('key').eq('key', normalizedRole).single();
    if (!roleCheck) return res.status(400).json({ error: 'Invalid role.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const created = await adminClient.auth.admin.createUser({ email: String(email).trim(), password, email_confirm: true });
    if (created.error || !created.data?.user) return res.status(400).json({ error: created.error?.message || 'Could not create user.' });
    const newId = created.data.user.id;

    const roleInsert = await adminClient.from('user_roles').insert([{ id: newId, email: String(email).trim(), role: normalizedRole, active: true }]);
    if (roleInsert.error) { await adminClient.auth.admin.deleteUser(newId); return res.status(400).json({ error: roleInsert.error.message }); }

    const profileInsert = await adminClient.from('profiles').upsert([{ id: newId, email: String(email).trim(), full_name: String(full_name || '').trim() || null, role: normalizedRole, active: true }], { onConflict: 'id' });
    if (profileInsert.error) { await adminClient.from('user_roles').delete().eq('id', newId); await adminClient.auth.admin.deleteUser(newId); return res.status(400).json({ error: profileInsert.error.message }); }

    return res.status(201).json({ user: { id: newId, email: created.data.user.email }, role: normalizedRole });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Internal server error.' });
  }
}