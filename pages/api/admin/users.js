import { createClient } from '@supabase/supabase-js';

const allowedRoles = new Set([
  'admin', 'ceo', 'finance', 'manager', 'team_leader',
  'sales', 'marketing', 'operations', 'support'
]);

async function validateStructure(adminClient, { managerId, teamLeaderId, teamId }) {
  if (managerId) {
    const { data } = await adminClient
      .from('user_roles')
      .select('id,role,active')
      .eq('id', managerId)
      .single();
    if (!data?.active || !['admin', 'ceo', 'manager'].includes(String(data.role || '').toLowerCase())) {
      return 'Selected manager is invalid or inactive.';
    }
  }

  if (teamLeaderId) {
    const { data } = await adminClient
      .from('user_roles')
      .select('id,role,active')
      .eq('id', teamLeaderId)
      .single();
    if (!data?.active || String(data.role || '').toLowerCase() !== 'team_leader') {
      return 'Selected team leader is invalid or inactive.';
    }
  }

  if (teamId) {
    const { data } = await adminClient
      .from('teams')
      .select('id,active')
      .eq('id', teamId)
      .single();
    if (!data?.active) return 'Selected team is invalid or inactive.';
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server-side Supabase keys are not configured.' });
  }

  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing access token.' });

    const publicClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await publicClient.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session.' });

    const adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerRole, error: roleError } = await adminClient
      .from('user_roles')
      .select('role,active')
      .eq('id', userData.user.id)
      .single();

    if (roleError || !callerRole?.active) {
      return res.status(403).json({ error: 'Account is inactive or role is unavailable.' });
    }

    const callerRoleKey = String(callerRole.role || '').trim().toLowerCase();
    const { data: permissionRow } = await adminClient
      .from('app_role_permissions')
      .select('permission_key')
      .eq('role_key', callerRoleKey)
      .eq('permission_key', 'users.manage')
      .maybeSingle();

    if (!permissionRow) {
      return res.status(403).json({ error: 'You do not have permission to create users.' });
    }

    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.full_name || '').trim().slice(0, 200);
    const normalizedRole = String(body.role || '').trim().toLowerCase();
    const managerId = body.manager_id || null;
    const teamLeaderId = body.team_leader_id || null;
    const teamId = body.team_id || null;

    if (fullName.length < 2) return res.status(400).json({ error: 'Full name is required.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!normalizedRole || !allowedRoles.has(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const { data: roleCheck } = await adminClient
      .from('app_roles')
      .select('key')
      .eq('key', normalizedRole)
      .single();
    if (!roleCheck) return res.status(400).json({ error: 'Role is not configured in app_roles.' });

    const structureError = await validateStructure(adminClient, { managerId, teamLeaderId, teamId });
    if (structureError) return res.status(400).json({ error: structureError });

    const created = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.error || !created.data?.user) {
      return res.status(400).json({ error: created.error?.message || 'Could not create user.' });
    }

    const newId = created.data.user.id;
    const rollbackAuthUser = async () => {
      await adminClient.from('profiles').delete().eq('id', newId);
      await adminClient.from('user_roles').delete().eq('id', newId);
      await adminClient.auth.admin.deleteUser(newId);
    };

    const roleInsert = await adminClient.from('user_roles').insert([{
      id: newId,
      email,
      role: normalizedRole,
      active: true,
    }]);

    if (roleInsert.error) {
      await rollbackAuthUser();
      return res.status(400).json({ error: 'Could not assign the user role.' });
    }

    const profileInsert = await adminClient.from('profiles').upsert([{
      id: newId,
      email,
      full_name: fullName,
      role: normalizedRole,
      active: true,
      manager_id: managerId,
      team_leader_id: teamLeaderId,
      team_id: teamId,
    }], { onConflict: 'id' });

    if (profileInsert.error) {
      await rollbackAuthUser();
      return res.status(400).json({ error: 'Could not create the employee profile.' });
    }

    await adminClient.from('audit_logs').insert([{
      user_id: userData.user.id,
      action: 'CREATE_USER',
      table_name: 'profiles',
      details: {
        created_user_id: newId,
        role: normalizedRole,
        manager_id: managerId,
        team_leader_id: teamLeaderId,
        team_id: teamId,
      },
    }]);

    return res.status(201).json({
      user: { id: newId, email, full_name: fullName },
      role: normalizedRole,
    });
  } catch (error) {
    console.error('Create user API error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
