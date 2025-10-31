-- Add new health parameters to symptom_logs table
ALTER TABLE symptom_logs 
ADD COLUMN IF NOT EXISTS weight numeric,
ADD COLUMN IF NOT EXISTS blood_pressure_systolic integer,
ADD COLUMN IF NOT EXISTS blood_pressure_diastolic integer,
ADD COLUMN IF NOT EXISTS had_sex boolean DEFAULT false;