-- Оптимизация базы данных для AI-ассистента

-- Индексы для быстрого поиска событий по пользователю и времени
CREATE INDEX IF NOT EXISTS idx_events_user_start_time 
ON events(user_id, start_time);

CREATE INDEX IF NOT EXISTS idx_events_user_end_time 
ON events(user_id, end_time);

-- Индекс для поиска pending предложений
CREATE INDEX IF NOT EXISTS idx_event_move_suggestions_user_status 
ON event_move_suggestions(user_id, status, created_at DESC);

-- Индекс для быстрого поиска логов симптомов
CREATE INDEX IF NOT EXISTS idx_symptom_logs_user_date 
ON symptom_logs(user_id, date DESC);

-- Индекс для поиска сообщений чата
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
ON chat_messages(user_id, created_at DESC);

-- Индекс для поиска по email_thread_id (для обработки ответов)
CREATE INDEX IF NOT EXISTS idx_event_move_suggestions_thread_id 
ON event_move_suggestions(email_thread_id) 
WHERE email_thread_id IS NOT NULL;

-- Composite index для эффективного поиска по event_id в предложениях
CREATE INDEX IF NOT EXISTS idx_event_move_suggestions_event_id 
ON event_move_suggestions(event_id);

-- Функция для автоматической очистки старых rejected предложений (хранить 30 дней)
CREATE OR REPLACE FUNCTION cleanup_old_rejected_suggestions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM event_move_suggestions
  WHERE status = 'rejected' 
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Комментарии для документации
COMMENT ON INDEX idx_events_user_start_time IS 'Ускоряет поиск событий пользователя по времени начала';
COMMENT ON INDEX idx_event_move_suggestions_user_status IS 'Ускоряет отображение pending предложений в UI';
COMMENT ON INDEX idx_symptom_logs_user_date IS 'Ускоряет загрузку истории симптомов';
COMMENT ON FUNCTION cleanup_old_rejected_suggestions IS 'Очистка старых отклонённых предложений для оптимизации БД';