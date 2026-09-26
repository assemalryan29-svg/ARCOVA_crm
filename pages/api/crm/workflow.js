import { createClient } from '@supabase/supabase-js';

const ACTIONS = Object.freeze({
  reserve: { rpc: 'reserve_unit_atomic', permission: 'reservations.manage' },
  release: { rpc: 'release_reservation_atomic', permission: 'reservations.manage' },
  confirm_deal: { rpc: 'confirm_reservation_as_deal', permission: 'deals.manage' },
  schedule: { rpc: 'generate_deal_payment_schedule', permission: 'finance.manage' },
  record_payment: { rpc: 'record_deal_payment', permission: 'finance.manage' },
});

function client(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: 'Bearer ' + token } },
    },
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  const action = String(req.body?.action || '');
  const config = ACTIONS[action];
  if (!config) return res.status(400).json({ error: 'Unsupported workflow action.' });

  const supabase = client(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: 'Invalid authentication token.' });

  const args = req.body?.args && typeof req.body.args === 'object' ? req.body.args : {};
  const allowedArgs = {
    reserve: ['p_lead_id','p_unit_id','p_reservation_amount','p_contract_value','p_expires_at','p_notes'],
    release: ['p_reservation_id','p_new_status'],
    confirm_deal: ['p_reservation_id','p_deal_value','p_down_payment','p_installment_months','p_payment_frequency','p_contract_date','p_commission','p_notes'],
    schedule: ['p_deal_id','p_first_due_date'],
    record_payment: ['p_payment_id','p_paid_at','p_notes'],
  }[action];

  const cleanArgs = Object.fromEntries(
    Object.entries(args).filter(([key]) => allowedArgs.includes(key))
  );

  if (action === 'reserve') {
    if (!cleanArgs.p_lead_id || !cleanArgs.p_unit_id || cleanArgs.p_reservation_amount == null) {
      return res.status(400).json({ error: 'Lead, unit and reservation amount are required.' });
    }
    cleanArgs.p_reservation_amount = Number(cleanArgs.p_reservation_amount);
    if (!Number.isFinite(cleanArgs.p_reservation_amount) || cleanArgs.p_reservation_amount < 0) {
      return res.status(400).json({ error: 'Invalid reservation amount.' });
    }
    if (cleanArgs.p_contract_value != null) {
      cleanArgs.p_contract_value = Number(cleanArgs.p_contract_value);
      if (!Number.isFinite(cleanArgs.p_contract_value) || cleanArgs.p_contract_value < 0) {
        return res.status(400).json({ error: 'Invalid contract value.' });
      }
    }
  }

  if (action === 'confirm_deal') {
    if (!cleanArgs.p_reservation_id || cleanArgs.p_deal_value == null) {
      return res.status(400).json({ error: 'Reservation and deal value are required.' });
    }
    cleanArgs.p_deal_value = Number(cleanArgs.p_deal_value);
    cleanArgs.p_down_payment = Number(cleanArgs.p_down_payment || 0);
    cleanArgs.p_commission = Number(cleanArgs.p_commission || 0);
    if (![cleanArgs.p_deal_value, cleanArgs.p_down_payment, cleanArgs.p_commission].every(Number.isFinite) ||
        cleanArgs.p_deal_value < 0 || cleanArgs.p_down_payment < 0 || cleanArgs.p_commission < 0) {
      return res.status(400).json({ error: 'Invalid financial values.' });
    }
    if (cleanArgs.p_installment_months != null && cleanArgs.p_installment_months !== '') {
      cleanArgs.p_installment_months = Number(cleanArgs.p_installment_months);
      if (!Number.isInteger(cleanArgs.p_installment_months) || cleanArgs.p_installment_months <= 0) {
        return res.status(400).json({ error: 'Invalid installment months.' });
      }
    } else {
      cleanArgs.p_installment_months = null;
    }
  }

  try {
    const { data, error } = await supabase.rpc(config.rpc, cleanArgs);
    if (error) {
      console.error('CRM workflow rejected:', error);
      return res.status(400).json({ error: error.message || 'Workflow operation rejected.' });
    }
    return res.status(200).json({ success: true, action, data });
  } catch (error) {
    console.error('CRM workflow error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
