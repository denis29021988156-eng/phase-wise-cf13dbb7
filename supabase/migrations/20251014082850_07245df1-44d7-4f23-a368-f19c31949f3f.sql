-- Создаем таблицу для хранения уведомлений
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_for DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Включаем RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Индекс для быстрого поиска непрочитанных уведомлений
CREATE INDEX idx_notifications_user_scheduled ON public.notifications(user_id, scheduled_for, sent_at);

-- Включаем pg_cron для планировщика задач
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Включаем pg_net для HTTP запросов
CREATE EXTENSION IF NOT EXISTS pg_net;