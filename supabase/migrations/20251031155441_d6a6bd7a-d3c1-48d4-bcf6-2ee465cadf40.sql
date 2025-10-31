-- Создать таблицу для истории действий с событиями
CREATE TABLE public.event_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'boost_moved', 'manual_moved', 'created', 'deleted', 'ai_suggested'
  old_start_time TIMESTAMP WITH TIME ZONE,
  new_start_time TIMESTAMP WITH TIME ZONE,
  old_end_time TIMESTAMP WITH TIME ZONE,
  new_end_time TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Включить RLS
ALTER TABLE public.event_actions ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут видеть свои действия
CREATE POLICY "Users can view their own event actions"
ON public.event_actions
FOR SELECT
USING (auth.uid() = user_id);

-- Политика: пользователи могут создавать свои действия
CREATE POLICY "Users can insert their own event actions"
ON public.event_actions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Индекс для быстрого поиска по событию и пользователю
CREATE INDEX idx_event_actions_event_id ON public.event_actions(event_id);
CREATE INDEX idx_event_actions_user_id ON public.event_actions(user_id);
CREATE INDEX idx_event_actions_created_at ON public.event_actions(created_at DESC);