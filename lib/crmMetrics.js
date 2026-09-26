/**
 * ARCOVA CRM - Shared reporting definitions.
 * Dashboard, Reports and Forecasting MUST use these same calculations.
 */

export const ACTIVE_LEAD_STATUSES = Object.freeze([
  'New Lead',
  'Contacted',
  'Interested',
  'Meeting Set',
  'Closed Won',
  'Lost'
]);

export const FORECAST_STAGE_WEIGHTS = Object.freeze({
  'New Lead': 0.05,
  Contacted: 0.10,
  Interested: 0.25,
  'Meeting Set': 0.45,
  'Closed Won': 1,
  Lost: 0
});

const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const groupCount = (rows, key, fallback = 'Unknown') =>
  rows.reduce((result, row) => {
    const value = row?.[key] || fallback;
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});

export function buildCrmMetrics({
  leads = [],
  deals = [],
  reservations = [],
  payments = [],
  followups = [],
  calls = [],
  appointments = [],
  projects = [],
  units = [],
  now = Date.now()
} = {}) {
  const activeLeads = leads.filter((lead) => lead?.status !== 'Archived');
  const archivedLeads = leads.filter((lead) => lead?.status === 'Archived');

  const pipeline = groupCount(activeLeads, 'status');
  const sources = groupCount(activeLeads, 'lead_source');
  const temperatures = activeLeads.reduce((result, lead) => {
    const value = lead?.temperature || 'Warm';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});

  const activeLeadBudget = activeLeads.reduce((sum, lead) => sum + number(lead?.budget), 0);
  const weightedPipelineForecast = activeLeads.reduce((sum, lead) => {
    const weight = FORECAST_STAGE_WEIGHTS[lead?.status] ?? 0;
    return sum + (number(lead?.budget) * weight);
  }, 0);

  const wonDeals = deals.filter((deal) => deal?.status === 'Won');
  const wonDealValue = wonDeals.reduce((sum, deal) => sum + number(deal?.deal_value), 0);

  const activeReservations = reservations.filter((reservation) => reservation?.status !== 'Cancelled');
  const reservedValue = activeReservations.reduce((sum, reservation) => sum + number(reservation?.reservation_amount), 0);

  const pendingPayments = payments
    .filter((payment) => payment?.status !== 'Paid' && payment?.status !== 'Cancelled')
    .reduce((sum, payment) => sum + number(payment?.amount), 0);

  const overduePayments = payments.filter((payment) => (
    payment?.status === 'Overdue' ||
    (payment?.status === 'Pending' && payment?.due_date && new Date(payment.due_date).getTime() < now)
  )).length;

  const pendingFollowups = followups.filter((item) => item?.status === 'Pending');
  const overdueFollowups = pendingFollowups.filter((item) =>
    item?.followup_date && new Date(item.followup_date).getTime() < now
  );
  const upcomingAppointments = appointments.filter((item) =>
    item?.status === 'Planned' &&
    item?.scheduled_at &&
    new Date(item.scheduled_at).getTime() >= now
  );

  const interestedCount = activeLeads.filter((lead) => lead?.status === 'Interested').length;
  const closedWonLeadCount = activeLeads.filter((lead) => lead?.status === 'Closed Won').length;
  const conversionRate = activeLeads.length
    ? (closedWonLeadCount / activeLeads.length) * 100
    : 0;

  return {
    leads,
    activeLeads,
    archivedLeads,
    totalLeads: activeLeads.length,
    archivedLeadsCount: archivedLeads.length,
    interestedCount,
    closedWonLeadCount,
    conversionRate,
    pipeline,
    sources,
    temperatures,
    activeLeadBudget,
    weightedPipelineForecast,
    forecastMethod: 'Lead budget × status probability',
    forecastWeights: FORECAST_STAGE_WEIGHTS,
    deals,
    wonDeals,
    wonDealValue,
    reservations,
    activeReservations,
    reservedValue,
    payments,
    pendingPayments,
    overduePayments,
    followups,
    pendingFollowups: pendingFollowups.length,
    overdueFollowups: overdueFollowups.length,
    calls,
    appointments,
    upcomingAppointments: upcomingAppointments.length,
    projects,
    units
  };
}
