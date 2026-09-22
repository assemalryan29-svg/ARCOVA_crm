/**
 * Single source of truth for lead statuses.
 *
 * Legacy values remain supported so existing production records are not
 * silently invalidated. New UI work should use the canonical pipeline values.
 */
export const LEAD_STATUSES = Object.freeze([
  { value: 'New Lead', label: 'New Lead', order: 10 },
  { value: 'Contacted', label: 'Contacted', order: 20 },
  { value: 'Qualified', label: 'Qualified', order: 30 },
  { value: 'Interested', label: 'Interested', order: 40 },
  { value: 'Project Sent', label: 'Project Sent', order: 50 },
  { value: 'Meeting', label: 'Meeting', order: 60 },
  { value: 'Viewing', label: 'Viewing', order: 70 },
  { value: 'Negotiation', label: 'Negotiation', order: 80 },
  { value: 'Reservation', label: 'Reservation', order: 90 },
  { value: 'Contract', label: 'Contract', order: 100 },
  { value: 'Closed Won', label: 'Closed Won', order: 110 },
  { value: 'Closed Lost', label: 'Closed Lost', order: 120 },
  // Legacy values: retained until a reviewed data migration is completed.
  { value: 'Meeting Set', label: 'Meeting Set', order: 61, legacy: true },
  { value: 'Lost', label: 'Lost', order: 121, legacy: true },
  { value: 'Archived', label: 'Archived', order: 999, legacy: true },
]);

export const LEAD_STATUS_VALUES = new Set(LEAD_STATUSES.map((status) => status.value));

export function isValidLeadStatus(value) {
  return typeof value === 'string' && LEAD_STATUS_VALUES.has(value);
}
