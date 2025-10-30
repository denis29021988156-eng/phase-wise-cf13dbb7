import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Heart, Smile, Zap, Moon, Brain, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SymptomLog {
  energy: number;
  mood: string[];
  physical_symptoms: string[];
  sleep_quality: number;
  stress_level: number;
  wellness_index: number;
}

interface SymptomsInputProps {
  currentLog: SymptomLog;
  onUpdate: (log: SymptomLog) => void;
  onSave: () => void;
  loading: boolean;
  physicalOptions: Array<{ id: string; label: string; value: number }>;
  moodOptions: Array<{ id: string; label: string; value: number }>;
}

export const SymptomsInput = ({
  currentLog,
  onUpdate,
  onSave,
  loading,
  physicalOptions,
  moodOptions
}: SymptomsInputProps) => {
  const { t } = useTranslation();

  const toggleSelection = (category: 'mood' | 'physical_symptoms', id: string) => {
    const current = currentLog[category];
    const updated = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id];
    
    onUpdate({ ...currentLog, [category]: updated });
  };

  return (
    <div className="space-y-3">
      {/* Физическое состояние */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            {t('symptoms.physicalState')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto pr-1">
            {physicalOptions.map(option => (
              <Badge
                key={option.id}
                variant={currentLog.physical_symptoms.includes(option.id) ? 'default' : 'outline'}
                className="cursor-pointer text-[10px] py-0.5 px-2 transition-all hover:scale-105"
                onClick={() => toggleSelection('physical_symptoms', option.id)}
              >
                {option.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Настроение */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Smile className="h-3.5 w-3.5" />
            {t('symptoms.mood')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {moodOptions.map(option => (
              <Badge
                key={option.id}
                variant={currentLog.mood.includes(option.id) ? 'default' : 'outline'}
                className="cursor-pointer text-[10px] py-0.5 px-2 transition-all hover:scale-105"
                onClick={() => toggleSelection('mood', option.id)}
              >
                {option.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Уровень энергии */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            {t('symptoms.energyLevel')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            <Slider
              value={[currentLog.energy]}
              onValueChange={(value) => onUpdate({ ...currentLog, energy: value[0] })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('symptoms.low')}</span>
              <span className="font-semibold text-foreground">{currentLog.energy}/5</span>
              <span>{t('symptoms.high')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Качество сна */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" />
            {t('symptoms.sleepQuality')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            <Slider
              value={[currentLog.sleep_quality]}
              onValueChange={(value) => onUpdate({ ...currentLog, sleep_quality: value[0] })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('symptoms.low')}</span>
              <span className="font-semibold text-foreground">{currentLog.sleep_quality}/5</span>
              <span>{t('symptoms.high')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Уровень стресса */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            {t('symptoms.stressLevel')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            <Slider
              value={[currentLog.stress_level]}
              onValueChange={(value) => onUpdate({ ...currentLog, stress_level: value[0] })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('symptoms.low')}</span>
              <span className="font-semibold text-foreground">{currentLog.stress_level}/5</span>
              <span>{t('symptoms.high')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Кнопка сохранения */}
      <Button 
        onClick={onSave} 
        disabled={loading}
        className="w-full"
        size="sm"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
            {t('symptoms.saving')}
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            {t('symptoms.save')}
          </>
        )}
      </Button>
    </div>
  );
};