-- 1. Добавить отдельное поле для Microsoft event ID
ALTER TABLE events ADD COLUMN IF NOT EXISTS microsoft_event_id TEXT;

-- 2. Создать индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_events_google_event_id ON events(google_event_id) WHERE google_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_microsoft_event_id ON events(microsoft_event_id) WHERE microsoft_event_id IS NOT NULL;

-- 3. Создать таблицу для rate limiting
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_endpoint_window UNIQUE(user_id, endpoint, window_start)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limits"
ON public.api_rate_limits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage rate limits"
ON public.api_rate_limits FOR ALL
USING (true);

-- 4. Функция для очистки старых записей rate limiting (>1 час)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM api_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- 5. Настройка Cron Jobs для автоматизации
-- Убедитесь что расширения включены
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Cron job для ai-week-planner (каждый день в 9:00 UTC)
-- Важно: Замените YOUR_ANON_KEY на реальный ANON KEY из проекта
SELECT cron.schedule(
  'ai-week-planner-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-week-planner',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dGVmc2V4eHd0bHJvcHprbXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjIxOTEsImV4cCI6MjA3NDA5ODE5MX0.fPbLIqM08fdMuAO2vQO5mj-Zt3yBpTmmUXrwAV5fWg0"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);

-- Cron job для очистки старых логов (каждый день в 2:00 UTC)
SELECT cron.schedule(
  'cleanup-ai-logs-daily',
  '0 2 * * *',
  $$
  SELECT cleanup_old_ai_logs();
  $$
);

-- Cron job для очистки старых rate limits (каждый час)
SELECT cron.schedule(
  'cleanup-rate-limits-hourly',
  '0 * * * *',
  $$
  SELECT cleanup_old_rate_limits();
  $$
);

-- Cron job для очистки старых отклоненных предложений (каждую неделю)
SELECT cron.schedule(
  'cleanup-rejected-suggestions-weekly',
  '0 3 * * 0',
  $$
  SELECT cleanup_old_rejected_suggestions();
  $$
);

-- 6. Проверить существующие cron jobs
-- SELECT * FROM cron.job;