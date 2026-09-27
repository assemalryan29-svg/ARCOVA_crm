import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: { bodyParser: false },
};

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function timingSafeEqualHex(a, b) {
  try {
    const aa = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function verifyMetaSignature(rawBody, signature) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const supplied = String(signature).replace(/^sha256=/, '');
  return timingSafeEqualHex(expected, supplied);
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\\D/g, '');
  if (!digits) return '';
  // Egyptian mobile numbers are compared by their last 10 digits so
  // 010..., 10..., and 2010... can match the same CRM lead.
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function firstField(fieldData, names) {
  const wanted = new Set(names.map((name) => String(name).toLowerCase()));
  const row = (fieldData || []).find((item) => wanted.has(String(item?.name || '').toLowerCase()));
  return row?.values?.[0] == null ? '' : String(row.values[0]).trim();
}

function textMessage(message) {
  if (!message) return '';
  if (message.type === 'text') return String(message.text?.body || '').trim();
  if (message.type === 'button') return String(message.button?.text || '').trim();
  if (message.type === 'interactive') {
    return String(
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      ''
    ).trim();
  }
  return '[' + String(message.type || 'message') + ']';
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function claimEvent(supabase, provider, eventId, eventType) {
  if (!eventId) return true;
  const { error } = await supabase.from('integration_events').insert([{
    provider,
    event_id: eventId,
    event_type: eventType || null,
  }]);
  if (!error) {
    return true;
  }
  if (error.code === '23505') {
    return false;
  }
  throw error;
}

async function pickSalesOwner(supabase) {
  const { data: sales, error } = await supabase
    .from('user_roles')
    .select('id')
    .eq('role', 'sales')
    .eq('active', true);

  if (error || !sales?.length) return null;

  const counts = await Promise.all(
    sales.map(async (member) => {
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', member.id)
        .neq('status', 'Archived');
      return { id: member.id, count: Number(count || 0) };
    }),
  );

  counts.sort((a, b) => a.count - b.count);
  return counts[0]?.id || null;
}

async function findLead(supabase, { externalSource, externalLeadId, phone }) {
  if (externalSource && externalLeadId) {
    const { data } = await supabase
      .from('leads')
      .select('id,name,phone,email,assigned_to')
      .eq('external_source', externalSource)
      .eq('external_lead_id', externalLeadId)
      .maybeSingle();
    if (data) return data;
  }

  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const { data } = await supabase
    .from('leads')
    .select('id,name,phone,email,assigned_to')
    .eq('phone_normalized', normalized)
    .limit(1)
    .maybeSingle();

  if (data) return data;

  const { data: phoneRows } = await supabase
    .from('leads')
    .select('id,name,phone,email,assigned_to')
    .limit(500);

  return (phoneRows || []).find((row) => normalizePhone(row.phone) === normalized) || null;
}

async function createOrUpdateLead(supabase, input) {
  const existing = await findLead(supabase, input);

  if (existing) {
    const patch = {};
    if (!existing.email && input.email) patch.email = input.email;
    if (!existing.phone_normalized) patch.phone_normalized = normalizePhone(input.phone);
    if (!existing.external_source && input.externalSource) patch.external_source = input.externalSource;
    if (!existing.external_lead_id && input.externalLeadId) patch.external_lead_id = input.externalLeadId;

    if (Object.keys(patch).length) {
      await supabase.from('leads').update(patch).eq('id', existing.id);
    }

    return { lead: existing, created: false };
  }

  const assignedTo = input.assignedTo || await pickSalesOwner(supabase);
  const payload = {
    name: input.name || 'WhatsApp / Facebook Lead',
    phone: input.phone || '',
    email: input.email || null,
    lead_source: input.leadSource,
    status: 'New Lead',
    temperature: 'Warm',
    assigned_to: assignedTo,
    phone_normalized: normalizePhone(input.phone) || null,
    email_normalized: normalizeEmail(input.email) || null,
    external_source: input.externalSource || null,
    external_lead_id: input.externalLeadId || null,
  };

  const { data, error } = await supabase.from('leads').insert([payload]).select('*').single();
  if (error) throw error;
  return { lead: data, created: true };
}

async function recordActivity(supabase, leadId, createdBy, note) {
  if (!leadId || !note) return;
  await supabase.from('lead_activities').insert([{
    lead_id: leadId,
    created_by: createdBy,
    note,
  }]);
}

async function retrieveFacebookLead(leadgenId) {
  const token = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN is not configured.');

  const url = new URL('https://graph.facebook.com/' + GRAPH_VERSION + '/' + encodeURIComponent(leadgenId));
  url.searchParams.set('fields', 'id,created_time,field_data,page_id,form_id,ad_id,adgroup_id');
  url.searchParams.set('access_token', token);

  const response = await fetch(url.toString());
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Meta lead retrieval failed.');
  }
  return data;
}

async function handleFacebookLead(supabase, value) {
  const leadgenId = String(value?.leadgen_id || '');
  if (!leadgenId) return { ignored: true, reason: 'Missing leadgen_id' };

  const claimed = await claimEvent(supabase, 'facebook', leadgenId, 'leadgen');
  if (!claimed) return { duplicate: true, leadgenId };

  const lead = await retrieveFacebookLead(leadgenId);
  const fieldData = lead?.field_data || [];

  const name = firstField(fieldData, ['full_name', 'name', 'first_name']) || 'Facebook Lead';
  const phone = firstField(fieldData, ['phone_number', 'phone', 'mobile_phone']);
  const email = firstField(fieldData, ['email', 'email_address']);

  if (!phone) {
    await recordActivity(
      supabase,
      null,
      'Facebook Lead Ads',
      'Lead received without phone. leadgen_id=' + leadgenId,
    );
    return { accepted: true, leadgenId, warning: 'No phone field in Facebook form.' };
  }

  const result = await createOrUpdateLead(supabase, {
    name,
    phone,
    email,
    leadSource: 'Facebook Lead Ads',
    externalSource: 'facebook_leadgen',
    externalLeadId: leadgenId,
  });

  await recordActivity(
    supabase,
    result.lead.id,
    'Facebook Lead Ads',
    'Lead received from Facebook Lead Ads. leadgen_id=' + leadgenId +
      ', form_id=' + String(lead?.form_id || value?.form_id || '') +
      ', ad_id=' + String(lead?.ad_id || value?.ad_id || ''),
  );

  return { leadId: result.lead.id, created: result.created, leadgenId };
}

async function handleWhatsAppMessage(supabase, value) {
  const messages = Array.isArray(value?.messages) ? value.messages : [];
  const contact = value?.contacts?.[0];
  const profileName = String(contact?.profile?.name || '').trim();

  const results = [];
  for (const message of messages) {
    const messageId = String(message?.id || '');
    const phone = String(message?.from || '').trim();
    if (!phone) continue;

    const claimed = await claimEvent(supabase, 'whatsapp', messageId || phone + ':' + String(message?.timestamp || ''), 'message');
    if (!claimed) {
      results.push({ duplicate: true, messageId });
      continue;
    }

    const result = await createOrUpdateLead(supabase, {
      name: profileName || phone,
      phone,
      email: '',
      leadSource: 'WhatsApp Business',
      externalSource: 'whatsapp_business',
      externalLeadId: null,
    });

    const messageText = textMessage(message);
    await recordActivity(
      supabase,
      result.lead.id,
      'WhatsApp Business',
      'Incoming WhatsApp message' + (messageText ? ': ' + messageText : '') +
        (messageId ? ' | message_id=' + messageId : ''),
    );

    results.push({ leadId: result.lead.id, created: result.created, messageId });
  }

  return results;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = String(req.query['hub.mode'] || '');
    const token = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || '';

    if (mode === 'subscribe' && expected && token === expected) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);

  if (!verifyMetaSignature(rawBody, req.headers['x-hub-signature-256'])) {
    return res.status(403).json({ error: 'Invalid Meta webhook signature.' });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase server configuration is incomplete.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  const supabase = serviceClient();

  try {
    if (payload?.object === 'page') {
      const results = [];
      for (const entry of payload.entry || []) {
        for (const change of entry?.changes || []) {
          if (change?.field !== 'leadgen') continue;
          results.push(await handleFacebookLead(supabase, change.value || {}));
        }
      }
      return res.status(200).json({ received: true, channel: 'facebook', results });
    }

    if (payload?.object === 'whatsapp_business_account') {
      const results = [];
      for (const entry of payload.entry || []) {
        for (const change of entry?.changes || []) {
          if (change?.field !== 'messages') continue;
          results.push(...await handleWhatsAppMessage(supabase, change.value || {}));
        }
      }
      return res.status(200).json({ received: true, channel: 'whatsapp', results });
    }

    return res.status(200).json({ received: true, ignored: true });
  } catch (error) {
    console.error('Meta webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
}
