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
  const [physicalOpen, setPhysicalOpen] = useState(true);
  const [moodOpen, setMoodOpen] = useState(false);

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
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="url(#gradient-energy)"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(wellnessIndex / 100) * 351.86} 351.86`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="gradient-energy" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold bg-gradient-to-br from-purple-600 to-pink-600 bg-clip-text text-transparent">
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

        {/* Sleep & Stress (compact) */}
        <Card className="border-border/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">😴</span>
              Сон
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
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
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">😰</span>
              Стресс
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
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
          </CardContent>
        </Card>

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
