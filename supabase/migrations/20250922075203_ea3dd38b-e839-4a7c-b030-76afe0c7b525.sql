-- Create edge function for generating AI suggestions
CREATE OR REPLACE FUNCTION public.generate_ai_suggestion_content(
  event_title TEXT,
  event_description TEXT DEFAULT NULL,
  cycle_day INTEGER,
  cycle_length INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  phase TEXT;
  suggestion_text TEXT;
BEGIN
  -- Determine cycle phase
  IF cycle_day <= 5 THEN
    phase := 'menstrual';
  ELSIF cycle_day <= 13 THEN
    phase := 'follicular';
  ELSIF cycle_day <= 15 THEN
    phase := 'ovulation';
  ELSE
    phase := 'luteal';
  END IF;

  -- Generate basic suggestion based on phase and event type
  CASE 
    WHEN phase = 'menstrual' THEN
      CASE 
        WHEN LOWER(event_title) LIKE '%тренировка%' OR LOWER(event_title) LIKE '%спорт%' THEN
          suggestion_text := 'Во время менструации лучше выбрать легкие упражнения - йогу, растяжку или короткую прогулку. Избегайте интенсивных нагрузок.';
        WHEN LOWER(event_title) LIKE '%встреча%' OR LOWER(event_title) LIKE '%работа%' THEN
          suggestion_text := 'В начале цикла уровень энергии может быть снижен. Планируйте важные встречи на вторую половину дня, когда самочувствие улучшится.';
        ELSE
          suggestion_text := 'В период менструации важно больше отдыхать, пить теплые напитки и избегать стрессовых ситуаций.';
      END CASE;
    
    WHEN phase = 'follicular' THEN
      CASE 
        WHEN LOWER(event_title) LIKE '%тренировка%' OR LOWER(event_title) LIKE '%спорт%' THEN
          suggestion_text := 'Отличное время для активных тренировок! Уровень энергии высокий, можно заниматься кардио и силовыми упражнениями.';
        WHEN LOWER(event_title) LIKE '%встреча%' OR LOWER(event_title) LIKE '%работа%' THEN
          suggestion_text := 'Фолликулярная фаза - время высокой продуктивности и концентрации. Идеально для важных переговоров и сложных задач.';
        ELSE
          suggestion_text := 'Сейчас ваш организм полон энергии! Хорошее время для начинания новых проектов и активной деятельности.';
      END CASE;
      
    WHEN phase = 'ovulation' THEN
      CASE 
        WHEN LOWER(event_title) LIKE '%тренировка%' OR LOWER(event_title) LIKE '%спорт%' THEN
          suggestion_text := 'Период овуляции - пик физической силы! Отличное время для интенсивных тренировок и достижения новых результатов.';
        WHEN LOWER(event_title) LIKE '%встреча%' OR LOWER(event_title) LIKE '%работа%' THEN
          suggestion_text := 'Во время овуляции вы особенно харизматичны и убедительны. Планируйте важные презентации и переговоры.';
        ELSE
          suggestion_text := 'Время овуляции - пик женской энергии! Используйте этот период для реализации амбициозных планов.';
      END CASE;
      
    WHEN phase = 'luteal' THEN
      CASE 
        WHEN LOWER(event_title) LIKE '%тренировка%' OR LOWER(event_title) LIKE '%спорт%' THEN
          suggestion_text := 'В лютеиновой фазе лучше выбрать умеренные нагрузки - пилатес, йогу или легкую аэробику. Организм нуждается в более мягком подходе.';
        WHEN LOWER(event_title) LIKE '%встреча%' OR LOWER(event_title) LIKE '%работа%' THEN
          suggestion_text := 'Во второй половине цикла может снижаться стрессоустойчивость. Планируйте буферное время и избегайте перегрузок.';
        ELSE
          suggestion_text := 'Лютеиновая фаза - время для рефлексии и планирования. Сосредоточьтесь на завершении текущих дел.';
      END CASE;
  END CASE;

  RETURN suggestion_text;
END;
$$;