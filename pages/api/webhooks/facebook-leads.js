import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function verifySignature(rawBody, signature, appSecret) {
  if (!signature || !appSecret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function mapFieldData(fieldData = []) {
  return fieldData.reduce((result, item) => {
    const key = String(item?.name || '').toLowerCase();
    const value = item?.values?.[0] ?? '';
    if (key) result[key] = value;
    return result;
  }, {});
}

function normalizePhone(value) { return String(value || '').replace(/[^0-9]/g, '').replace(/^20/, '0'); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }

export default async function handler(req, res) {
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  if (req.method === 'GET') {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) return res.status(200).send(req.query['hub.challenge']);
    return res.status(403).json({ error: 'Webhook verification failed.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const rawBody = await readRawBody(req);
  if (!verifySignature(rawBody, req.headers['x-hub-signature-256'], process.env.FACEBOOK_APP_SECRET)) return res.status(401).json({ error: 'Invalid webhook signature.' });

  let payload;
  try { payload = JSON.parse(rawBody.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid JSON payload.' }); }
  if (payload.object !== 'page') return res.status(200).json({ received: true, ignored: true });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageAccessToken) return res.status(500).json({ error: 'Facebook page access token is not configured.' });

  let processed = 0;
  let skipped = 0;
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const leadgenId = change?.value?.leadgen_id;
      if (!leadgenId) continue;
      const graphUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(pageAccessToken)}`;
      const graphResponse = await fetch(graphUrl);
      const graphData = await graphResponse.json();
      if (!graphResponse.ok) return res.status(502).json({ error: 'Facebook lead lookup failed.', details: graphData });

      const fields = mapFieldData(graphData.field_data);
      const name = fields.full_name || fields.name || fields.first_name || 'Facebook Lead';
      const phone = fields.phone_number || fields.phone || '';
      const email = fields.email || '';
      const phoneKey = normalizePhone(phone);
      const emailKey = normalizeEmail(email);
      let duplicate = false;
      if (phoneKey) {
        const result = await supabase.from('leads').select('id').eq('phone', phone).limit(1);
        duplicate = Boolean(result.data?.length);
      }
      if (!duplicate && emailKey) {
        const result = await supabase.from('leads').select('id').ilike('email', emailKey).limit(1);
        duplicate = Boolean(result.data?.length);
      }
      if (duplicate) { skipped += 1; continue; }

      const { error } = await supabase.from('leads').insert([{ name, phone, email, lead_source: 'Facebook Lead Ads', status: 'New Lead' }]);
      if (error) return res.status(500).json({ error: 'Lead insert failed.', details: error.message });
      processed += 1;
    }
  }
  return res.status(200).json({ received: true, processed, skipped });
}
