import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase server configuration is incomplete.' });
  }

  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing access token.' });

  const publicClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await publicClient.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid session.' });

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role,active')
    .eq('id', userData.user.id)
    .single();

  const role = String(roleRow?.role || '').toLowerCase();
  if (!roleRow?.active || !['admin', 'ceo', 'marketing', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Insufficient permissions.' });
  }

  return res.status(200).json({
    ok: true,
    webhook_path: '/api/webhooks/facebook-leads',
    graph_api_version: process.env.FACEBOOK_GRAPH_API_VERSION || 'v20.0',
    configured: {
      verify_token: Boolean(process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN),
      app_secret: Boolean(process.env.FACEBOOK_APP_SECRET),
      page_access_token: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
      service_role: Boolean(serviceRoleKey),
    },
  });
}
