-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the check-gmail-replies function to run every 5 minutes
SELECT cron.schedule(
  'check-gmail-replies-every-5-min',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/check-gmail-replies',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dGVmc2V4eHd0bHJvcHprbXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjIxOTEsImV4cCI6MjA3NDA5ODE5MX0.fPbLIqM08fdMuAO2vQO5mj-Zt3yBpTmmUXrwAV5fWg0"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
