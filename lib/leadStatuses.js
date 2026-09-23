/**
 * ARCOVA CRM - Canonical lead pipeline status contract.
 *
 * Legacy values are kept readable/writable until a reviewed data migration
 * converts existing rows. "Archived" is an archival state, not a pipeline stage.
 */

export const LEAD_STATUSES = Object.freeze([
  'New Lead',
  'Contacted',
  'Qualified',
  'Interested',
  'Project Sent',
  'Meeting',
  'Viewing',
  'Negotiation',
  'Reservation',
  'Contract',
  'Closed Won',
  'Closed Lost',

  // Legacy values kept for backward compatibility during migration.
  'Meeting Set',
  'Lost',
  'Archived',
]);

export const LEAD_STATUS_VALUES = Object.freeze(new Set(LEAD_STATUSES));

export const LEAD_STATUS_OPTIONS = Object.freeze([
  { value: 'New Lead', label: '📥 عميل جديد' },
  { value: 'Contacted', label: '📞 تم الاتصال' },
  { value: 'Qualified', label: '✅ مؤهل' },
  { value: 'Interested', label: '🔥 مهتم' },
  { value: 'Project Sent', label: '📋 تم إرسال المشروع' },
  { value: 'Meeting', label: '📅 موعد' },
  { value: 'Viewing', label: '🏠 معاينة' },
  { value: 'Negotiation', label: '🤝 تفاوض' },
  { value: 'Reservation', label: '📝 حجز' },
  { value: 'Contract', label: '✍️ تعاقد' },
  { value: 'Closed Won', label: '💰 تم البيع' },
  { value: 'Closed Lost', label: '❌ مغلق - لم يتم البيع' },
]);

export const LEGACY_LEAD_STATUS_OPTIONS = Object.freeze({
  'Meeting Set': { value: 'Meeting Set', label: '📅 تم تحديد موعد (قديم)' },
  Lost: { value: 'Lost', label: '❌ غير مهتم (قديم)' },
  Archived: { value: 'Archived', label: '🗃️ مؤرشف' },
});

export function isValidLeadStatus(value) {
  return typeof value === 'string' && LEAD_STATUS_VALUES.has(value);
}

/**
 * Returns the canonical pipeline options and, only when necessary, the
 * legacy value currently stored on a lead. This prevents creating new
 * legacy statuses while keeping old records editable.
 */
export function getLeadStatusOptions(currentStatus) {
  if (!currentStatus || !LEGACY_LEAD_STATUS_OPTIONS[currentStatus]) {
    return LEAD_STATUS_OPTIONS;
  }
  return Object.freeze([
    ...LEAD_STATUS_OPTIONS,
    LEGACY_LEAD_STATUS_OPTIONS[currentStatus],
  ]);
}
