import React from 'react';

const COLORS = {
  surface: '#fffaf0',
  panel: '#f5efe3',
  border: '#d9c5a4',
  gold: '#b08a4a',
  text: '#3f321f',
  muted: '#806f56',
  green: '#2f8f6b',
  danger: '#a7352b',
  warning: '#b45309'
};

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'غير محدد';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('ar-EG') + ' ج.م' : String(value);
}

function maskPhone(phone, fullAccess) {
  if (!phone) return 'بدون هاتف';
  return fullAccess ? phone : `******${String(phone).slice(-4)}`;
}

function statusLabel(status) {
  const map = {
    'New Lead': 'عميل جديد',
    Contacted: 'تم الاتصال',
    Interested: 'مهتم جداً',
    'Meeting Set': 'موعد محدد',
    'Closed Won': 'تم التعاقد',
    Lost: 'غير مهتم',
    Archived: 'مؤرشف'
  };
  return map[status] || status || 'غير محدد';
}

export default function LeadCard({
  lead,
  userRole,
  folders,
  teamMembers,
  canUpdate,
  canArchive,
  canAssign,
  statusOptions,
  temperatureOptions,
  onOpen,
  onStatusChange,
  onTemperatureChange,
  onFolderChange,
  onArchive
}) {
  const phone = String(lead.phone || '').replace(/[^0-9+]/g, '');
  const whatsappPhone = String(lead.phone || '').replace(/[^0-9]/g, '');
  const assigned = teamMembers?.find((member) => member.id === lead.assigned_to);

  return (
    <article
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding: 14,
        boxShadow: '0 8px 24px rgba(118,85,34,.08)',
        display: 'grid',
        gap: 11
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: COLORS.text, fontWeight: 800, fontSize: 16, overflowWrap: 'anywhere' }}>
            {lead.name || 'بدون اسم'}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{maskPhone(lead.phone, userRole === 'admin')}</div>
        </div>
        <span style={{
          flexShrink: 0,
          padding: '5px 9px',
          borderRadius: 999,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
          color: COLORS.gold,
          fontSize: 11,
          fontWeight: 800
        }}>
          {statusLabel(lead.status)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: COLORS.panel, borderRadius: 10, padding: 9 }}>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>المصدر</div>
          <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 700, marginTop: 3 }}>{lead.lead_source || '—'}</div>
        </div>
        <div style={{ background: COLORS.panel, borderRadius: 10, padding: 9 }}>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>الميزانية</div>
          <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 700, marginTop: 3 }}>{formatMoney(lead.budget)}</div>
        </div>
        <div style={{ background: COLORS.panel, borderRadius: 10, padding: 9 }}>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>المنطقة</div>
          <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 700, marginTop: 3 }}>{lead.preferred_area || 'غير محدد'}</div>
        </div>
        <div style={{ background: COLORS.panel, borderRadius: 10, padding: 9 }}>
          <div style={{ color: COLORS.muted, fontSize: 10 }}>الموعد القادم</div>
          <div style={{ color: lead.next_follow_up ? COLORS.green : COLORS.muted, fontSize: 12, fontWeight: 700, marginTop: 3 }}>
            {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'غير محدد'}
          </div>
        </div>
      </div>

      {lead.folder && (
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '5px 9px', background: COLORS.panel, borderRadius: 999, color: COLORS.gold, fontSize: 11, fontWeight: 700 }}>
          📁 {lead.folder}
        </div>
      )}

      <div style={{ color: COLORS.muted, fontSize: 11 }}>
        المسؤول: <strong style={{ color: COLORS.text }}>{assigned?.full_name || assigned?.email || 'غير مخصص'}</strong>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {canUpdate && (
          <select
            value={lead.status || 'New Lead'}
            onChange={(event) => onStatusChange(lead.id, event.target.value)}
            style={{ minHeight: 42, border: `1px solid ${COLORS.border}`, borderRadius: 10, background: COLORS.surface, color: COLORS.text, padding: '0 10px', fontWeight: 700 }}
          >
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        )}

        {canUpdate && (
          <select
            value={lead.temperature || 'Warm'}
            onChange={(event) => onTemperatureChange(lead.id, event.target.value)}
            style={{ minHeight: 42, border: `1px solid ${COLORS.border}`, borderRadius: 10, background: COLORS.surface, color: COLORS.text, padding: '0 10px', fontWeight: 700 }}
          >
            {(temperatureOptions || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        )}

        {canUpdate && folders?.length > 0 && (
          <select
            value={lead.folder || ''}
            onChange={(event) => onFolderChange(lead.id, event.target.value)}
            style={{ minHeight: 42, border: `1px solid ${COLORS.border}`, borderRadius: 10, background: COLORS.surface, color: COLORS.text, padding: '0 10px', fontWeight: 700 }}
          >
            <option value="">بدون مجلد</option>
            {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <button type="button" onClick={() => onOpen(lead)} style={{ minHeight: 44, border: 0, borderRadius: 10, background: COLORS.gold, color: COLORS.surface, fontWeight: 800, cursor: 'pointer' }}>
          التفاصيل
        </button>

        {canArchive && (
          <button type="button" onClick={() => onArchive(lead)} style={{ minHeight: 44, border: `1px solid #d9a07a`, borderRadius: 10, background: '#fff6ef', color: COLORS.danger, fontWeight: 800, cursor: 'pointer' }}>
            🗑️ أرشفة
          </button>
        )}

        {canUpdate && (
          <a href={`tel:${phone}`} style={{ minHeight: 44, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#eaf6ef', color: '#176b4d', textDecoration: 'none', fontWeight: 800 }}>
            📞 اتصال
          </a>
        )}

        {canUpdate && whatsappPhone && (
          <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" style={{ minHeight: 44, display: 'grid', placeItems: 'center', borderRadius: 10, background: '#eaf6ef', color: '#176b4d', textDecoration: 'none', fontWeight: 800 }}>
            🟢 واتساب
          </a>
        )}

        {canAssign && (
          <select
            value={lead.assigned_to || ''}
            onChange={(event) => onFolderChange('__ASSIGN__:' + lead.id, event.target.value)}
            style={{ minHeight: 44, gridColumn: '1 / -1', border: `1px solid ${COLORS.border}`, borderRadius: 10, background: COLORS.surface, color: COLORS.text, padding: '0 10px', fontWeight: 700 }}
          >
            <option value="">غير مخصص</option>
            {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name || member.email}</option>)}
          </select>
        )}
      </div>
    </article>
  );
}
