import { supabase } from '../supabaseClient';
import { normalizeRole } from './permissions';

/**
 * Client-side identity loader.
 * Authorization is still enforced by Supabase RLS; this helper only keeps
 * the UI role lookup consistent and never trusts email as a role source.
 */
export async function getCurrentIdentity() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (sessionError || !session?.user) {
    return { session: null, user: null, role: null, profile: null, error: sessionError || new Error('No active session') };
  }

  const [{ data: roleRow, error: roleError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('user_roles').select('role,active').eq('id', session.user.id).maybeSingle(),
    supabase.from('profiles').select('id,email,full_name,role,active,team_leader_id,manager_id,team_id').eq('id', session.user.id).maybeSingle(),
  ]);

  const rawRole = roleRow?.active === false ? null : (roleRow?.role || profile?.role);
  const role = normalizeRole(rawRole);

  return {
    session,
    user: session.user,
    role,
    profile: profile || null,
    error: roleError || profileError || null,
  };
}
