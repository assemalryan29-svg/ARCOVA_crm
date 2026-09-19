/**
 * ARCOVA CRM - Lead validation helpers
 * Pure functions: safe to reuse in forms, CSV imports and API routes.
 */

export function normalizePhone(value) {
  return String(value || '').replace(/[^0-9+]/g, '').trim();
}

export function validateLeadInput(lead = {}) {
  const errors = {};
  const name = String(lead.name || '').trim();
  const phone = normalizePhone(lead.phone);

  if (!name) errors.name = 'اسم العميل مطلوب';
  if (!phone) errors.phone = 'رقم الهاتف مطلوب';
  if (phone && phone.replace(/\D/g, '').length < 8) {
    errors.phone = 'رقم الهاتف غير صحيح';
  }

  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(lead.email).trim())) {
    errors.email = 'البريد الإلكتروني غير صحيح';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function getLeadDuplicateKey(lead = {}) {
  const phone = normalizePhone(lead.phone).replace(/^\+20/, '0');
  const email = String(lead.email || '').trim().toLowerCase();
  return phone || email || String(lead.name || '').trim().toLowerCase();
}
