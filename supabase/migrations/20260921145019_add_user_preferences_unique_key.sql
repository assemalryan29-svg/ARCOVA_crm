-- RECOVERED MIGRATION FILE
-- Reconstructed from the live user_preferences index definition.

create unique index if not exists user_preferences_user_key_uidx
  on public.user_preferences (user_id, key);
