-- P2.3 — `audit_logs` no tenía más índice que la PK en `id`.
-- La vista de Logs (services/auditLogs.js) filtra por business_id y ordena por
-- created_at DESC; con volumen se degradaba a seq scan + sort.
-- Índice compuesto que sirve exactamente ese patrón.
--
-- Rollback: DROP INDEX IF EXISTS public.idx_audit_logs_business_created;

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created
  ON public.audit_logs (business_id, created_at DESC);
