-- ARCOVA CRM: harden normalization helper function search paths.
-- Applied to production on 2026-09-22.

alter function public.prevent_duplicate_lead() set search_path = '';
alter function public.arcova_normalize_phone(text) set search_path = '';
alter function public.arcova_normalize_email(text) set search_path = '';
