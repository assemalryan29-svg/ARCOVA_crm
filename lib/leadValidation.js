/**
 * ARCOVA CRM - Lead validation and duplicate detection.
 * Client-side validation is a UX layer; the database trigger is authoritative.
 */

export function normalizePhone(value) {
  return String(value || '').replace(/[^0-9]/g, '').trim();
}

export function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || '';
}

export function validateLeadInput(lead = {}) {
  const errors = {};
  const name = String(lead.name || '').trim();
  const phone = normalizePhone(lead.phone);
  const email = normalizeEmail(lead.email);

  if (!name) errors.name = 'اسم العميل مطلوب';
  if (!phone) errors.phone = 'رقم الهاتف مطلوب';
  if (phone && phone.length < 8) errors.phone = 'رقم الهاتف غير صحيح';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'البريد الإلكتروني غير صحيح';

  return { valid: Object.keys(errors).length === 0, errors };
}

export function getLeadDuplicateKeys(lead = {}) {
  const keys = [];
  const phone = normalizePhone(lead.phone);
  const email = normalizeEmail(lead.email);
  if (phone) keys.push('phone:' + phone);
  if (email) keys.push('email:' + email);
  return keys;
}

export function getLeadDuplicateKey(lead = {}) {
  return getLeadDuplicateKeys(lead)[0] || ('name:' + String(lead.name || '').trim().toLowerCase());
}

export function isDuplicateLead(a, b) {
  const aKeys = new Set(getLeadDuplicateKeys(a));
  return getLeadDuplicateKeys(b).some((key) => aKeys.has(key));
}
