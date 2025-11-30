-- Recreate rolling_memory_overview with security_invoker so RLS and caller perms apply.
DROP VIEW IF EXISTS public.rolling_memory_overview;

CREATE VIEW public.rolling_memory_overview
WITH (security_invoker = true) AS
SELECT
  ud.user_identifier AS user_id,
  ud.id AS user_data_id,
  LENGTH(ud.long_term_memory) AS memory_size,
  LEFT(ud.long_term_memory, 100) AS memory_preview,
  COUNT(gcm.id) AS active_messages,
  (SELECT COUNT(*) FROM public.archived_chat_messages acm
    WHERE acm.user_id = ud.user_identifier) AS archived_messages,
  (SELECT MAX(archived_at) FROM public.archived_chat_messages acm
    WHERE acm.user_id = ud.user_identifier) AS last_compression_at,
  COUNT(gcm.id) > 10 AS should_compress,
  ud.updated_at AS memory_updated_at
FROM public.user_data ud
LEFT JOIN public.general_chat_messages gcm ON gcm.user_id = ud.user_identifier
GROUP BY ud.id, ud.user_identifier, ud.long_term_memory, ud.updated_at;

COMMENT ON VIEW public.rolling_memory_overview IS
  'Overview of rolling memory status for all users';

GRANT SELECT ON public.rolling_memory_overview TO service_role;
