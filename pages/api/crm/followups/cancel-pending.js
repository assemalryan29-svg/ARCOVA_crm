import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization token.' });
  const token = auth.slice(7).trim();
  const leadId = String(req.query.lead_id || '').trim();
  if (!leadId) return res.status(400).json({ error: 'lead_id is required.' });

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } }
  });
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: 'Invalid authentication token.' });

  const { error } = await client.from('followups')
    .update({ status: 'Cancelled' })
    .eq('lead_id', leadId)
    .eq('status', 'Pending');

  if (error) return res.status(400).json({ error: 'Unable to cancel pending followups.' });
  return res.status(200).json({ success: true });
}
