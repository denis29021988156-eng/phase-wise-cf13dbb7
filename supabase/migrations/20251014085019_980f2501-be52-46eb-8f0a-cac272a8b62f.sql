-- Настраиваем cron job для ежедневной проверки уведомлений о менструации
-- Функция будет запускаться каждый день в 09:00 UTC
SELECT cron.schedule(
  'check-period-notifications-daily',
  '0 9 * * *', -- Каждый день в 09:00 UTC
  $$
  SELECT
    net.http_post(
        url:='https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/check-period-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dGVmc2V4eHd0bHJvcHprbXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjIxOTEsImV4cCI6MjA3NDA5ODE5MX0.fPbLIqM08fdMuAO2vQO5mj-Zt3yBpTmmUXrwAV5fWg0"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);