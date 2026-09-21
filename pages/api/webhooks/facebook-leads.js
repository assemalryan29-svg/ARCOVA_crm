import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function verifySignature(rawBody, signature, appSecret) {
  if (!signature || !appSecret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function mapFieldData(fieldData = []) {
  return fieldData.reduce((result, item) => {
    const key = String(item?.name || '').trim().toLowerCase();
    const value = item?.values?.[0] ?? '';
    if (key) result[key] = value;
    return result;
  }, {});
}

function normalizePhone(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function fetchFacebookLead(leadgenId, accessToken) {
  const version = process.env.FACEBOOK_GRAPH_API_VERSION || 'v20.0';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(leadgenId)}`);
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('fields', 'id,created_time,field_data,form_id,ad_id,adset_id,campaign_id');

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error('Facebook lead lookup failed.');
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function alreadyProcessed(client, leadgenId) {
  const { data } = await client
    .from('leads')
    .select('id')
    .eq('external_source', 'facebook')
    .eq('external_lead_id', String(leadgenId))
    .limit(1);
  return Boolean(data?.length);
}

export default async function handler(req, res) {
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

  if (req.method === 'GET') {
    if (
      verifyToken &&
      req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === verifyToken
    ) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).json({ error: 'Webhook verification failed.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!appSecret || !pageAccessToken || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Facebook integration is not fully configured.' });
  }

  const rawBody = await readRawBody(req);
  if (!verifySignature(rawBody, req.headers['x-hub-signature-256'], appSecret)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  if (payload.object !== 'page') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let transientFailure = false;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const leadgenId = change?.value?.leadgen_id;
      if (!leadgenId) continue;

      try {
        if (await alreadyProcessed(client, leadgenId)) {
          skipped += 1;
          continue;
        }

        const graphData = await fetchFacebookLead(leadgenId, pageAccessToken);
        const fields = mapFieldData(graphData.field_data);
        const name =
          fields.full_name ||
          fields.name ||
          [fields.first_name, fields.last_name].filter(Boolean).join(' ') ||
          'Facebook Lead';
        const phone = fields.phone_number || fields.phone || '';
        const email = normalizeEmail(fields.email);

        if (!normalizePhone(phone)) {
          failed += 1;
          continue;
        }

        const row = {
          name: String(name).trim().slice(0, 200),
          phone: String(phone).trim().slice(0, 60),
          email: email || null,
          lead_source: 'Facebook Lead Ads',
          status: 'New Lead',
          external_source: 'facebook',
          external_lead_id: String(leadgenId),
        };

        const { error } = await client.from('leads').insert([row]);
        if (error) {
          if (error.code === '23505') {
            skipped += 1;
            continue;
          }
          throw error;
        }

        processed += 1;
      } catch (error) {
        failed += 1;
        const status = Number(error?.status || 0);
        if (!status || status >= 500 || status === 429) transientFailure = true;
        console.error('Facebook lead processing failed:', {
          leadgenId: String(leadgenId),
          status,
          message: error?.message,
        });
      }
    }
  }

  const body = { received: true, processed, skipped, failed };
  if (transientFailure) return res.status(500).json(body);
  return res.status(200).json(body);
}
