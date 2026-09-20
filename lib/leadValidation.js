/**
 * ARCOVA CRM - Lead validation and duplicate detection.
 */

export function normalizePhone(value) {
  return String(value || '').replace(/[^0-9+]/g, '').trim();
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateLeadInput(lead = {}) {
  const errors = {};
  const name = String(lead.name || '').trim();
  const phone = normalizePhone(lead.phone);
  const email = normalizeEmail(lead.email);

  if (!name) errors.name = 'اسم العميل مطلوب';
  if (!phone) errors.phone = 'رقم الهاتف مطلوب';
  if (phone && phone.replace(/\D/g, '').length < 8) errors.phone = 'رقم الهاتف غير صحيح';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'البريد الإلكتروني غير صحيح';

  return { valid: Object.keys(errors).length === 0, errors };
}

export function getLeadDuplicateKeys(lead = {}) {
  const keys = [];
  const phone = normalizePhone(lead.phone).replace(/^\+20/, '0');
  const email = normalizeEmail(lead.email);
  if (phone) keys.push('phone:' + phone.replace(/\D/g, ''));
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
