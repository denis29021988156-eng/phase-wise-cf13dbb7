-- Таблица для логирования retry попыток
CREATE TABLE IF NOT EXISTS ai_retry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL, -- 'email_send', 'ai_generation', 'token_refresh', etc.
  attempt_number INTEGER NOT NULL,
  error_message TEXT,
  http_status INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_retry_logs_user_created ON ai_retry_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_retry_logs_operation ON ai_retry_logs(operation_type, created_at DESC);

-- Таблица для метрик работы AI-ассистента
CREATE TABLE IF NOT EXISTS ai_operation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'week_planner', 'email_send', 'email_reply', etc.
  status TEXT NOT NULL, -- 'success', 'error', 'timeout'
  execution_time_ms INTEGER,
  user_id UUID,
  error_details TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_metrics_type_status ON ai_operation_metrics(operation_type, status, created_at DESC);
CREATE INDEX idx_ai_metrics_created ON ai_operation_metrics(created_at DESC);

-- Таблица для критических уведомлений
CREATE TABLE IF NOT EXISTS ai_error_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL, -- 'api_failure', 'timeout', 'rate_limit', etc.
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  operation_type TEXT,
  user_id UUID,
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_notifications_unnotified ON ai_error_notifications(notified, severity, created_at DESC);
CREATE INDEX idx_ai_notifications_unresolved ON ai_error_notifications(resolved, created_at DESC);

-- RLS политики для новых таблиц
ALTER TABLE ai_retry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_operation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_error_notifications ENABLE ROW LEVEL SECURITY;

-- Пользователи могут видеть только свои логи
CREATE POLICY "Users can view their own retry logs"
ON ai_retry_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own metrics"
ON ai_operation_metrics FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

-- Service role может писать во все таблицы (для edge functions)
CREATE POLICY "Service role can insert retry logs"
ON ai_retry_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can insert metrics"
ON ai_operation_metrics FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can insert notifications"
ON ai_error_notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update notifications"
ON ai_error_notifications FOR UPDATE
USING (true);

-- Функция для автоматической очистки старых логов (хранить 7 дней)
CREATE OR REPLACE FUNCTION cleanup_old_ai_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM ai_retry_logs WHERE created_at < NOW() - INTERVAL '7 days';
  DELETE FROM ai_operation_metrics WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM ai_error_notifications WHERE resolved = true AND created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Функция для получения статистики работы AI
CREATE OR REPLACE FUNCTION get_ai_stats(days_back INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_suggestions', (
      SELECT COUNT(*) FROM event_move_suggestions
      WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
    ),
    'accepted_suggestions', (
      SELECT COUNT(*) FROM event_move_suggestions
      WHERE status = 'completed' AND created_at > NOW() - (days_back || ' days')::INTERVAL
    ),
    'rejected_suggestions', (
      SELECT COUNT(*) FROM event_move_suggestions
      WHERE status = 'rejected' AND created_at > NOW() - (days_back || ' days')::INTERVAL
    ),
    'emails_sent', (
      SELECT COUNT(*) FROM event_move_suggestions
      WHERE status = 'email_sent' AND created_at > NOW() - (days_back || ' days')::INTERVAL
    ),
    'success_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2
      )
      FROM ai_operation_metrics
      WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
    ),
    'avg_execution_time_ms', (
      SELECT ROUND(AVG(execution_time_ms))
      FROM ai_operation_metrics
      WHERE created_at > NOW() - (days_back || ' days')::INTERVAL
      AND execution_time_ms IS NOT NULL
    ),
    'critical_errors', (
      SELECT COUNT(*) FROM ai_error_notifications
      WHERE severity IN ('high', 'critical')
      AND created_at > NOW() - (days_back || ' days')::INTERVAL
      AND resolved = false
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON TABLE ai_retry_logs IS 'Логи повторных попыток операций AI-ассистента';
COMMENT ON TABLE ai_operation_metrics IS 'Метрики производительности AI-операций';
COMMENT ON TABLE ai_error_notifications IS 'Критические уведомления об ошибках';
COMMENT ON FUNCTION get_ai_stats IS 'Получение статистики работы AI-ассистента за N дней';