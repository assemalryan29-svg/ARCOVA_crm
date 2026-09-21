import { useState } from 'react';

/**
 * ARCOVA reusable destructive-action control.
 * Keeps confirmation consistent across Leads, Tasks, Customer 360 and Operations.
 */
export default function ConfirmDeleteButton({
  table,
  recordId,
  leadId,
  label = 'حذف',
  onDeleted,
  disabled = false,
  className = '',
}) {
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (busy || disabled) return;

    const confirmed = window.confirm(
      'هل أنت متأكد من حذف هذا السجل؟\nلا يمكن التراجع عن هذه العملية.'
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        window.alert('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/records/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ table, id: recordId, lead_id: leadId }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'تعذر حذف السجل');

      onDeleted?.(recordId);
    } catch (error) {
      window.alert(error.message || 'حدث خطأ أثناء الحذف');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={disabled || busy}
      className={`arcova-danger-action ${className}`}
      aria-label={`${label} السجل`}
      title={`${label} السجل`}
    >
      {busy ? 'جاري...' : label}
    </button>
  );
}
