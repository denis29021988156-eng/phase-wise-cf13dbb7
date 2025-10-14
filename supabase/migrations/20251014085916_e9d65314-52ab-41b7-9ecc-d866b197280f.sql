-- Добавляем поля возраста, роста и веса в таблицу user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2);