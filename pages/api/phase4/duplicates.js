import { createClient } from '@supabase/supabase-js';

function db(key, token='') {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession:false, autoRefreshToken:false },
    global: token ? { headers:{ Authorization:'Bearer '+token } } : undefined
  });
}

async function adminActor(req, service) {
  const h=String(req.headers.authorization||'');
  if(!h.startsWith('Bearer ')) return null;
  const token=h.slice(7).trim();
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!anon) return null;
  const pub=db(anon);
  const {data,error}=await pub.auth.getUser(token);
  if(error||!data?.user) return null;
  const {data:role}=await service.from('user_roles').select('role,active').eq('id',data.user.id).maybeSingle();
  if(!role?.active || String(role.role).toLowerCase()!=='admin') return null;
  return {user:data.user,token};
}

export default async function handler(req,res){
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!serviceKey||!anon) return res.status(500).json({error:'Server configuration is incomplete.'});
  const service=db(serviceKey);
  const actor=await adminActor(req,service);
  if(!actor) return res.status(403).json({error:'Admin access required.'});

  if(req.method==='GET'){
    const {data:candidates,error}=await service.from('phase4_duplicate_candidates')
      .select('candidate_id,identity_type,identity_value,canonical_lead_id,duplicate_lead_ids,group_size,review_status,created_at')
      .eq('review_status','PENDING').order('identity_type').order('identity_value');
    if(error) return res.status(400).json({error:'Unable to load duplicate queue.'});
    const ids=[...new Set((candidates||[]).flatMap(c=>[c.canonical_lead_id,...(c.duplicate_lead_ids||[])]))];
    const {data:leads}=ids.length ? await service.from('leads').select('id,name,phone,email,status,assigned_to,created_at').in('id',ids) : {data:[]};
    const map=new Map((leads||[]).map(l=>[l.id,l]));
    return res.status(200).json({pending:candidates||[],leads:Object.fromEntries(map)});
  }

  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed.'});
  const body=req.body||{};
  const candidateId=String(body.candidate_id||'');
  const action=String(body.action||'');
  if(!candidateId || !['approve','reject'].includes(action)) return res.status(400).json({error:'candidate_id and action are required.'});

  const {data:candidate,error:candidateError}=await service.from('phase4_duplicate_candidates')
    .select('*').eq('candidate_id',candidateId).eq('review_status','PENDING').maybeSingle();
  if(candidateError||!candidate) return res.status(404).json({error:'Pending duplicate candidate not found.'});

  if(action==='reject'){
    const {error}=await service.from('phase4_duplicate_candidates').update({review_status:'REJECTED'}).eq('candidate_id',candidateId);
    if(error) return res.status(400).json({error:'Could not reject candidate.'});
    await service.from('audit_logs').insert([{user_id:actor.user.id,action:'PHASE4_DUPLICATE_REJECT',table_name:'phase4_duplicate_candidates',details:{candidate_id:candidateId}}]);
    return res.status(200).json({ok:true,status:'REJECTED'});
  }

  try {
    const {data:merged,error:mergeError}=await service.rpc('merge_leads_atomic',{
      p_primary_lead_id:candidate.canonical_lead_id,
      p_duplicate_lead_ids:(candidate.duplicate_lead_ids||[]).filter(id=>id!==candidate.canonical_lead_id),
      p_actor_user_id:actor.user.id
    });
    if(mergeError) return res.status(400).json({error:mergeError.message||'Merge failed.'});
    const {error:updateError}=await service.from('phase4_duplicate_candidates').update({review_status:'EXECUTED'}).eq('candidate_id',candidateId).eq('review_status','PENDING');
    if(updateError) return res.status(400).json({error:'Merge completed but queue status could not be updated.'});
    await service.from('audit_logs').insert([{user_id:actor.user.id,action:'PHASE4_DUPLICATE_APPROVE',table_name:'phase4_duplicate_candidates',details:{candidate_id:candidateId,merge:merged}}]);
    return res.status(200).json({ok:true,status:'EXECUTED',merge:merged});
  } catch(error) {
    return res.status(500).json({error:'Duplicate merge failed.'});
  }
}
