import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SymptomLog {
  energy: number;
  mood: string[];
  physical_symptoms: string[];
  sleep_quality: number;
  stress_level: number;
  wellness_index: number;
  weight?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  had_sex?: boolean;
}

interface EnergySidebarProps {
  wellnessIndex: number;
  currentLog: SymptomLog;
  onUpdate: (log: SymptomLog) => void;
  onSave: () => void;
  loading: boolean;
  physicalOptions: Array<{ id: string; label: string; value: number }>;
  moodOptions: Array<{ id: string; label: string; value: number }>;
  phase?: string;
}

export function EnergySidebar({
  wellnessIndex,
  currentLog,
  onUpdate,
  onSave,
  loading,
  physicalOptions,
  moodOptions,
  phase = 'follicular'
}: EnergySidebarProps) {
  const [physicalOpen, setPhysicalOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [parametersOpen, setParametersOpen] = useState(false);

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'menstrual': return 'Менструация';
      case 'follicular': return 'Фолликулярная';
      case 'ovulation': return 'Овуляция';
      case 'luteal': return 'Лютеиновая';
      default: return 'Неизвестно';
    }
  };

  const togglePhysicalSymptom = (symptomId: string) => {
    const newSymptoms = currentLog.physical_symptoms.includes(symptomId)
      ? currentLog.physical_symptoms.filter(s => s !== symptomId)
      : [...currentLog.physical_symptoms, symptomId];
    onUpdate({ ...currentLog, physical_symptoms: newSymptoms });
  };

  const toggleMood = (moodId: string) => {
    const newMood = currentLog.mood.includes(moodId)
      ? currentLog.mood.filter(m => m !== moodId)
      : [...currentLog.mood, moodId];
    onUpdate({ ...currentLog, mood: newMood });
  };

  // Calculate energy spent
  const energySpent = currentLog.physical_symptoms.reduce((total, symptomId) => {
    const symptom = physicalOptions.find(s => s.id === symptomId);
    return total + Math.abs(symptom?.value || 0);
  }, 0);

  return (
    <div className="h-full overflow-y-auto bg-background/50">
      <div className="p-4 space-y-4">
        {/* Energy Index Circle */}
        <div className="flex flex-col items-center justify-center py-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Индекс самочувствия</h2>
          <div className="relative w-32 h-32">
            {/* Circular progress */}
            <svg className="w-32 h-32 transform -rotate-90">
              {/* Background circle - more visible */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted-foreground"
                opacity="0.6"
              />
              {/* Progress circle with color gradient based on value */}
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={
                  wellnessIndex <= 20 ? '#EF4444' : // red
                  wellnessIndex <= 40 ? '#F97316' : // orange
                  wellnessIndex <= 60 ? '#EAB308' : // yellow
                  wellnessIndex <= 80 ? '#84CC16' : // lime
                  '#22C55E' // green
                }
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(wellnessIndex / 100) * 351.86} 351.86`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                style={{
                  filter: `drop-shadow(0 0 6px ${
                    wellnessIndex <= 20 ? '#EF444440' :
                    wellnessIndex <= 40 ? '#F9731640' :
                    wellnessIndex <= 60 ? '#EAB30840' :
                    wellnessIndex <= 80 ? '#84CC1640' :
                    '#22C55E40'
                  })`
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold" style={{
                color: wellnessIndex <= 20 ? '#EF4444' :
                       wellnessIndex <= 40 ? '#F97316' :
                       wellnessIndex <= 60 ? '#EAB308' :
                       wellnessIndex <= 80 ? '#84CC16' :
                       '#22C55E'
              }}>
                {wellnessIndex}
              </span>
            </div>
          </div>
          <Badge variant="outline" className="mt-4 border-primary/50 text-primary">
            🔴 {getPhaseLabel(phase)}
          </Badge>
        </div>

        {/* Physical Symptoms */}
        <Collapsible open={physicalOpen} onOpenChange={setPhysicalOpen}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span className="text-lg">⚕️</span>
                    Физическое состояние
                  </CardTitle>
                  {physicalOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4 space-y-2">
                {physicalOptions.slice(0, 8).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => togglePhysicalSymptom(option.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                      currentLog.physical_symptoms.includes(option.id)
                        ? 'bg-primary/10 border border-primary/30 text-primary font-medium'
                        : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Mood */}
        <Collapsible open={moodOpen} onOpenChange={setMoodOpen}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span className="text-lg">😊</span>
                    Настроение
                  </CardTitle>
                  {moodOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {moodOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => toggleMood(option.id)}
                      className={`px-3 py-2 rounded-lg text-xs transition-all ${
                        currentLog.mood.includes(option.id)
                          ? 'bg-secondary/20 border border-secondary/50 text-secondary-foreground font-medium'
                          : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Parameters */}
        <Collapsible open={parametersOpen} onOpenChange={setParametersOpen}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    Параметры
                  </CardTitle>
                  {parametersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 pb-4 space-y-4">
                {/* Sleep */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">😴 Сон</span>
                  </div>
                  <Slider
                    value={[currentLog.sleep_quality]}
                    onValueChange={([value]) => onUpdate({ ...currentLog, sleep_quality: value })}
                    min={1}
                    max={5}
                    step={1}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Плохой</span>
                    <span>{currentLog.sleep_quality}/5</span>
                    <span>Отличный</span>
                  </div>
                </div>

                {/* Stress */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">😰 Стресс</span>
                  </div>
                  <Slider
                    value={[currentLog.stress_level]}
                    onValueChange={([value]) => onUpdate({ ...currentLog, stress_level: value })}
                    min={1}
                    max={5}
                    step={1}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Низкий</span>
                    <span>{currentLog.stress_level}/5</span>
                    <span>Высокий</span>
                  </div>
                </div>

                {/* Weight */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">⚖️ Вес (кг)</span>
                  </div>
                  <input
                    type="number"
                    value={currentLog.weight || ''}
                    onChange={(e) => onUpdate({ ...currentLog, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="Введите вес"
                    className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    step="0.1"
                    min="0"
                  />
                </div>

                {/* Blood Pressure */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🩺 Давление (мм рт.ст.)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={currentLog.blood_pressure_systolic || ''}
                      onChange={(e) => onUpdate({ ...currentLog, blood_pressure_systolic: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Верхнее"
                      className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      min="0"
                    />
                    <span className="self-center text-muted-foreground">/</span>
                    <input
                      type="number"
                      value={currentLog.blood_pressure_diastolic || ''}
                      onChange={(e) => onUpdate({ ...currentLog, blood_pressure_diastolic: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Нижнее"
                      className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      min="0"
                    />
                  </div>
                </div>

                {/* Sex */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">❤️ Секс</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onUpdate({ ...currentLog, had_sex: true })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                        currentLog.had_sex
                          ? 'bg-primary/10 border border-primary/30 text-primary font-medium'
                          : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      Да
                    </button>
                    <button
                      onClick={() => onUpdate({ ...currentLog, had_sex: false })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                        !currentLog.had_sex
                          ? 'bg-primary/10 border border-primary/30 text-primary font-medium'
                          : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      Нет
                    </button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Save Button */}
        <Button
          onClick={onSave}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
}
