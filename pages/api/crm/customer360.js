import { createClient } from '@supabase/supabase-js';

const TABLES = [
  ['lead_activities','created_at'],
  ['followups','followup_date'],
  ['calls','call_at'],
  ['appointments','scheduled_at'],
  ['tasks','due_date'],
  ['reservations','created_at'],
  ['deals','created_at']
];

function db(token) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization token.' });
  const token = auth.slice(7).trim();
  const leadId = String(req.query.lead_id || '').trim();
  if (!leadId) return res.status(400).json({ error: 'lead_id is required.' });

  const client = db(token);
  const { data: user, error: userError } = await client.auth.getUser(token);
  if (userError || !user?.user) return res.status(401).json({ error: 'Invalid authentication token.' });

  const { data: lead, error: leadError } = await client.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (leadError) return res.status(400).json({ error: 'Unable to load customer.' });
  if (!lead) return res.status(404).json({ error: 'Customer not found or outside your scope.' });

  const results = await Promise.all(TABLES.map(async ([table, orderColumn]) => {
    const { data, error } = await client.from(table).select('*').eq('lead_id', leadId).order(orderColumn, { ascending: false });
    return [table, error ? [] : (data || [])];
  }));

  const activities = results.flatMap(([table, rows]) => rows.map((row) => ({ ...row, entity_type: table })))
    .sort((a,b) => new Date(b.created_at || b.followup_date || b.call_at || b.scheduled_at || b.due_date).getTime() - new Date(a.created_at || a.followup_date || a.call_at || a.scheduled_at || a.due_date).getTime());

  return res.status(200).json({
    customer: lead,
    timeline: activities,
    followups: results.find(([t]) => t === 'followups')?.[1] || [],
    calls: results.find(([t]) => t === 'calls')?.[1] || [],
    appointments: results.find(([t]) => t === 'appointments')?.[1] || [],
    tasks: results.find(([t]) => t === 'tasks')?.[1] || [],
    reservations: results.find(([t]) => t === 'reservations')?.[1] || [],
    deals: results.find(([t]) => t === 'deals')?.[1] || []
  });
}
