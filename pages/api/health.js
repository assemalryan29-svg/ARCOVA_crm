export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const checks = {
    supabase_url: Boolean(supabaseUrl),
    public_key: Boolean(publicKey),
    supabase_api: false,
  };

  if (supabaseUrl && publicKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: publicKey,
          Authorization: `Bearer ${publicKey}`,
        },
        cache: 'no-store',
      });
      checks.supabase_api = response.ok || response.status === 404;
    } catch {
      checks.supabase_api = false;
    }
  }

  const ok = checks.supabase_url && checks.public_key && checks.supabase_api;

  return res.status(ok ? 200 : 503).json({
    ok,
    service: 'arcova-crm',
    timestamp: new Date().toISOString(),
    checks,
  });
}
