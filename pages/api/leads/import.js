import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const normalizePhone = (value) => String(value ?? '').replace(/[^0-9+]/g, '').replace(/^00/, '+');
const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const chunk = (items, size) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase server configuration is incomplete.' });
  }

  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  const token = authorization.slice(7).trim();
  const publicClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: 'Bearer ' + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: authData, error: authError } = await publicClient.auth.getUser(token);
  if (authError || !authData?.user) return res.status(401).json({ error: 'Invalid authentication token.' });

  const userId = authData.user.id;
  const { data: roleRow, error: roleError } = await serviceClient
    .from('user_roles')
    .select('role,active')
    .eq('id', userId)
    .maybeSingle();

  if (roleError || !roleRow?.active || !roleRow?.role) {
    return res.status(403).json({ error: 'Active canonical role is required.' });
  }

  const { data: permissionRow, error: permissionError } = await serviceClient
    .from('app_role_permissions')
    .select('permission_key')
    .eq('role_key', String(roleRow.role).trim().toLowerCase())
    .eq('permission_key', 'leads.import')
    .maybeSingle();

  if (permissionError || !permissionRow) {
    return res.status(403).json({ error: 'You do not have permission to import leads.' });
  }

  const rawLeads = Array.isArray(req.body?.leads) ? req.body.leads : [];
  if (!rawLeads.length) return res.status(400).json({ error: 'No leads supplied.' });
  if (rawLeads.length > 5000) return res.status(413).json({ error: 'Import limit is 5000 rows per request.' });

  const leads = rawLeads.map((lead) => ({
    name: String(lead?.name ?? '').trim(),
    phone: String(lead?.phone ?? '').trim(),
    email: String(lead?.email ?? '').trim() || null,
    lead_source: String(lead?.lead_source ?? 'Imported').trim() || 'Imported',
    status: String(lead?.status ?? 'New Lead').trim() || 'New Lead',
    assigned_to: userId
  }));

  const valid = [];
  const rejected = [];
  const seenPhones = new Set();
  const seenEmails = new Set();

  for (let index = 0; index < leads.length; index++) {
    const lead = leads[index];
    const phone = normalizePhone(lead.phone);
    const email = normalizeEmail(lead.email);

    if (!lead.name || !phone) {
      rejected.push({ index, reason: 'Name and phone are required.' });
      continue;
    }
    if (seenPhones.has(phone)) {
      rejected.push({ index, reason: 'Duplicate phone inside import.' });
      continue;
    }
    if (email && seenEmails.has(email)) {
      rejected.push({ index, reason: 'Duplicate email inside import.' });
      continue;
    }

    seenPhones.add(phone);
    if (email) seenEmails.add(email);
    valid.push({ ...lead, phone });
  }

  if (!valid.length) return res.status(200).json({ imported: 0, skipped: rejected.length, rejected });

  const phones = [...new Set(valid.map((lead) => lead.phone).filter(Boolean))];
  const emails = [...new Set(valid.map((lead) => normalizeEmail(lead.email)).filter(Boolean))];

  const existing = [];
  for (const phoneBatch of chunk(phones, 200)) {
    const { data, error } = await serviceClient.from('leads').select('id,phone,email').in('phone', phoneBatch);
    if (error) return res.status(500).json({ error: 'Could not check existing phone numbers.' });
    existing.push(...(data || []));
  }
  for (const emailBatch of chunk(emails, 200)) {
    const { data, error } = await serviceClient.from('leads').select('id,phone,email').in('email', emailBatch);
    if (error) return res.status(500).json({ error: 'Could not check existing email addresses.' });
    existing.push(...(data || []));
  }

  const existingPhones = new Set(existing.map((row) => normalizePhone(row.phone)).filter(Boolean));
  const existingEmails = new Set(existing.map((row) => normalizeEmail(row.email)).filter(Boolean));
  const ready = [];

  for (const lead of valid) {
    const phone = normalizePhone(lead.phone);
    const email = normalizeEmail(lead.email);
    if (existingPhones.has(phone) || (email && existingEmails.has(email))) {
      rejected.push({ name: lead.name, phone: lead.phone, reason: 'Already exists in database.' });
      continue;
    }
    ready.push(lead);
  }

  let imported = 0;
  const insertErrors = [];

  for (const batch of chunk(ready, 250)) {
    const { error } = await publicClient.from('leads').insert(batch);
    if (!error) {
      imported += batch.length;
      continue;
    }

    for (const lead of batch) {
      const single = await publicClient.from('leads').insert([lead]);
      if (single.error) {
        insertErrors.push({ name: lead.name, phone: lead.phone, reason: single.error.message });
      } else {
        imported++;
      }
    }
  }

  return res.status(200).json({
    imported,
    skipped: rejected.length + insertErrors.length,
    rejected: [...rejected, ...insertErrors].slice(0, 500)
  });
}
