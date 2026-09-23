import { createClient } from '@supabase/supabase-js';

const TABLES = Object.freeze({
  leads: { permission: 'leads.update', create: 'leads.create', delete: 'leads.delete', fields: ['name','phone','email','lead_source','status','assigned_to','temperature','next_follow_up','budget','unit_type','preferred_area','desired_unit_type','folder','preferred_location','project_id','external_source','external_lead_id'] },
  followups: { permission: 'followups.manage', fields: ['lead_id','assigned_to','followup_date','type','status','notes'] },
  calls: { permission: 'calls.manage', fields: ['lead_id','assigned_to','call_at','duration_seconds','outcome','notes'] },
  appointments: { permission: 'appointments.manage', fields: ['lead_id','assigned_to','scheduled_at','type','status','notes'] },
  projects: { permission: 'projects.manage', fields: ['name','location','project_type','delivery','land_area','built_percentage','loading_min','loading_max','description'] },
  units: { permission: 'units.manage', fields: ['title','type','price','status','project_id','unit_number','area'] },
  tasks: { permission: 'tasks.manage', fields: ['user_id','title','is_completed','lead_id','due_date','description','status','created_by'] },
  campaigns: { permission: 'campaigns.manage', fields: ['name','platform','budget','start_date','end_date','status'] },
  deals: { permission: 'deals.manage', fields: ['lead_id','unit_id','sales_person','deal_value','commission','status','reservation_id','down_payment','installment_months','payment_frequency','contract_date','notes'] },
  reservations: { permission: 'reservations.manage', fields: ['lead_id','unit_id','sales_person','reservation_amount','contract_value','status','expires_at','notes'] },
  deal_payments: { permission: 'finance.manage', fields: ['deal_id','installment_no','due_date','amount','paid_at','status','notes'] },
  lead_folders: { permission: 'leads.create', fields: ['name','created_by','active'] },
  lead_logs: { permission: 'leads.update', fields: ['lead_id','user_email','action_type','content'] }
});

function client(key, token) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: 'Bearer ' + token } } : undefined
  });
}

function cleanPayload(table, data) {
  const allowed = new Set(TABLES[table].fields);
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.has(key)));
}

async function actorFromToken(token, service) {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) return null;
  const publicClient = client(anon, token);
  const { data, error } = await publicClient.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: roleRow } = await service.from('user_roles')
    .select('role,active').eq('id', data.user.id).maybeSingle();
  if (!roleRow?.active || !roleRow?.role) return null;

  const role = String(roleRow.role).trim().toLowerCase().replace(/\s+/g, '_');
  return { user: data.user, role };
}

async function allowed(service, role, permission) {
  const { data } = await service.from('app_role_permissions')
    .select('permission_key')
    .eq('role_key', role)
    .eq('permission_key', permission)
    .maybeSingle();
  return Boolean(data);
}

export default async function handler(req, res) {
  if (!['POST','PATCH','DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceRole) return res.status(500).json({ error: 'Server configuration is incomplete.' });

  const token = String(req.headers.authorization || '').startsWith('Bearer ')
    ? String(req.headers.authorization).slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  const service = client(serviceRole);
  const actor = await actorFromToken(token, service);
  if (!actor) return res.status(401).json({ error: 'Invalid authentication token.' });

  const body = req.body || {};
  const table = String(body.table || '');
  const config = TABLES[table];
  if (!config) return res.status(400).json({ error: 'Unsupported CRM table.' });

  const action = req.method === 'POST' ? 'create' : req.method === 'PATCH' ? 'update' : 'delete';
  const permission = action === 'create' ? (config.create || config.permission) : action === 'delete' ? config.delete || config.permission : config.permission;

  if (!(await allowed(service, actor.role, permission))) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  const writeClient = client(anon, token);
  let result;

  if (action === 'create') {
    const payload = cleanPayload(table, body.data);
    if (table === 'tasks') {
      payload.user_id = payload.user_id || actor.user.id;
      payload.created_by = payload.created_by || actor.user.id;
    }
    if (table === 'followups' || table === 'calls' || table === 'appointments') {
      payload.assigned_to = payload.assigned_to || actor.user.id;
    }
    if (table === 'deals') payload.sales_person = payload.sales_person || actor.user.id;
    if (table === 'reservations') payload.sales_person = payload.sales_person || actor.user.id;
    if (table === 'lead_folders') payload.created_by = payload.created_by || actor.user.id;

    result = await writeClient.from(table).insert([payload]).select('*').maybeSingle();
  } else {
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ error: 'Record id is required.' });

    if (action === 'update') {
      const payload = cleanPayload(table, body.data);
      result = await writeClient.from(table).update(payload).eq('id', id).select('*').maybeSingle();
    } else {
      result = await writeClient.from(table).delete().eq('id', id).select('id').maybeSingle();
    }
  }

  if (result.error) {
    console.error('CRM mutation rejected:', result.error);
    return res.status(400).json({ error: 'CRM mutation rejected by validation or authorization.' });
  }

  await service.from('audit_logs').insert([{
    user_id: actor.user.id,
    action: 'CRM_' + action.toUpperCase(),
    table_name: table,
    details: { record_id: result.data?.id || body.id || null }
  }]);

  return res.status(action === 'create' ? 201 : 200).json({ success: true, data: result.data || null });
}
