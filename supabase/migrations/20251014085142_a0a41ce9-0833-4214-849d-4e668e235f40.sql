-- Включаем realtime для таблицы notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Публикуем таблицу для realtime обновлений
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;