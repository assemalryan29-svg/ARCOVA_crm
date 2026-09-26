REVOKE ALL ON FUNCTION public.phase4_run_validation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.phase4_run_validation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.phase4_run_validation(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.phase4_run_validation(uuid) TO service_role;
