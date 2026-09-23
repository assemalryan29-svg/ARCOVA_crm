export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const hasSupabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasPublicKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return res.status(hasSupabaseUrl && hasPublicKey ? 200 : 503).json({
    ok: hasSupabaseUrl && hasPublicKey,
    service: 'arcova-crm',
    timestamp: new Date().toISOString(),
    checks: {
      supabase_url: hasSupabaseUrl,
      public_key: hasPublicKey,
    },
  });
}
