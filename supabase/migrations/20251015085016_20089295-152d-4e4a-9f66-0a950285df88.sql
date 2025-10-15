-- Таблица для хранения предложений AI по переносу событий
CREATE TABLE IF NOT EXISTS public.event_move_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  
  -- Предложение от AI
  suggestion_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  
  -- Предлагаемые новые дата/время
  suggested_new_start TIMESTAMP WITH TIME ZONE NOT NULL,
  suggested_new_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Статус предложения
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'email_sent', 'completed', 'failed')),
  
  -- Данные об отправке email
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_thread_id TEXT,
  participants TEXT[], -- emails участников
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_event_move_suggestions_user_id ON public.event_move_suggestions(user_id);
CREATE INDEX idx_event_move_suggestions_event_id ON public.event_move_suggestions(event_id);
CREATE INDEX idx_event_move_suggestions_status ON public.event_move_suggestions(status);

-- RLS политики
ALTER TABLE public.event_move_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own move suggestions"
  ON public.event_move_suggestions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own move suggestions"
  ON public.event_move_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own move suggestions"
  ON public.event_move_suggestions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own move suggestions"
  ON public.event_move_suggestions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Триггер для обновления updated_at
CREATE TRIGGER update_event_move_suggestions_updated_at
  BEFORE UPDATE ON public.event_move_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();