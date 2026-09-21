import { useState } from 'react';

/**
 * ARCOVA safe record action.
 * Archive is the default. Permanent deletion must be requested separately and is Admin-only on the API.
 */
export default function ConfirmDeleteButton({
  table,
  recordId,
  leadId,
  label = 'أرشفة',
  mode = 'archive',
  onDeleted,
  disabled = false,
  className = '',
}) {
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (busy || disabled) return;

    const confirmed = window.confirm(
      mode === 'permanent'
        ? 'تحذير: سيتم حذف السجل نهائيًا. هل أنت متأكد؟'
        : 'هل أنت متأكد من أرشفة هذا السجل؟ يمكن الاحتفاظ به للمراجعة لاحقًا.'
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
        body: JSON.stringify({ table, id: recordId, lead_id: leadId, mode }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'تعذر تنفيذ العملية');

      onDeleted?.(recordId, result);
    } catch (error) {
      window.alert(error.message || 'حدث خطأ أثناء تنفيذ العملية');
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
