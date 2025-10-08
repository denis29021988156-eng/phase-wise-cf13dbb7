import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { MoonPhase } from '@/components/ui/moon-phase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Brain, Zap, Moon } from 'lucide-react';

interface SymptomLog {
  energy: number;
  mood: string[];
  physical_symptoms: string[];
  sleep_quality: number;
  stress_level: number;
  wellness_index: number;
}

interface HistoryDay {
  date: string;
  wellness_index: number;
}

const Symptoms = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentLog, setCurrentLog] = useState<SymptomLog>({
    energy: 3,
    mood: [],
    physical_symptoms: [],
    sleep_quality: 3,
    stress_level: 3,
    wellness_index: 50
  });
  
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(false);

  // Данные для выбора
  const physicalOptions = [
    { id: 'pain', label: '🤕 Боль', value: -15 },
    { id: 'fatigue', label: '😴 Усталость', value: -10 },
    { id: 'energy', label: '💪 Бодрость', value: 15 },
    { id: 'cramps', label: '🩹 Спазмы', value: -12 },
    { id: 'headache', label: '🤯 Головная боль', value: -10 },
    { id: 'bloating', label: '🎈 Вздутие', value: -8 }
  ];

  const moodOptions = [
    { id: 'happy', label: '😊 Радость', value: 20 },
    { id: 'calm', label: '🧘 Спокойствие', value: 15 },
    { id: 'anxious', label: '😰 Тревога', value: -15 },
    { id: 'irritable', label: '😡 Раздражение', value: -12 },
    { id: 'sad', label: '😢 Грусть', value: -10 },
    { id: 'motivated', label: '✨ Вдохновение', value: 18 }
  ];

  // Загрузка истории за последние 7 дней
  useEffect(() => {
    loadHistory();
    loadTodayLog();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('symptom_logs')
      .select('date, wellness_index')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7);

    if (data) {
      setHistory(data);
    }
  };

  const loadTodayLog = async () => {
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    if (data) {
      setCurrentLog({
        energy: data.energy || 3,
        mood: data.mood || [],
        physical_symptoms: data.physical_symptoms || [],
        sleep_quality: data.sleep_quality || 3,
        stress_level: data.stress_level || 3,
        wellness_index: data.wellness_index || 50
      });
    }
  };

  // Расчет индекса самочувствия
  const calculateWellnessIndex = (log: SymptomLog) => {
    let score = 0;
    
    // Энергия (вес 0.3)
    score += (log.energy / 5) * 30;
    
    // Качество сна (вес 0.2)
    score += (log.sleep_quality / 5) * 20;
    
    // Стресс (вес 0.2, инвертированный)
    score += ((6 - log.stress_level) / 5) * 20;
    
    // Настроение (вес 0.15)
    const moodScore = log.mood.reduce((sum, moodId) => {
      const mood = moodOptions.find(m => m.id === moodId);
      return sum + (mood?.value || 0);
    }, 0);
    score += Math.max(-15, Math.min(15, moodScore));
    
    // Физические симптомы (вес 0.15)
    const physicalScore = log.physical_symptoms.reduce((sum, symptomId) => {
      const symptom = physicalOptions.find(s => s.id === symptomId);
      return sum + (symptom?.value || 0);
    }, 0);
    score += Math.max(-15, Math.min(15, physicalScore));
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    const wellnessIndex = calculateWellnessIndex(currentLog);
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { error } = await supabase
        .from('symptom_logs')
        .upsert({
          user_id: user.id,
          date: today,
          energy: currentLog.energy,
          mood: currentLog.mood,
          physical_symptoms: currentLog.physical_symptoms,
          sleep_quality: currentLog.sleep_quality,
          stress_level: currentLog.stress_level,
          wellness_index: wellnessIndex
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;

      setCurrentLog({ ...currentLog, wellness_index: wellnessIndex });
      await loadHistory();
      
      toast({
        title: 'Сохранено! ✨',
        description: getFeedbackText(wellnessIndex),
      });
    } catch (error) {
      console.error('Error saving symptoms:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить данные',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getFeedbackText = (index: number) => {
    if (index <= 30) return 'Отдохни сегодня 💧';
    if (index <= 60) return 'Всё стабильно 😊';
    return 'Ты в отличной форме ✨';
  };

  const getIndexColor = (index: number) => {
    if (index <= 30) return 'text-destructive';
    if (index <= 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  const toggleSelection = (category: 'mood' | 'physical_symptoms', id: string) => {
    const current = currentLog[category];
    const updated = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id];
    
    setCurrentLog({ ...currentLog, [category]: updated });
  };

  const wellnessIndex = calculateWellnessIndex(currentLog);

  return (
    <div className="container mx-auto p-4 max-w-2xl space-y-6">
      {/* Индекс самочувствия */}
      <Card className="border-border/50 shadow-[var(--shadow-soft)]">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Индекс самочувствия</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <div className="relative w-40 h-40">
            <MoonPhase value={wellnessIndex} className="w-full h-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-4xl font-bold ${getIndexColor(wellnessIndex)} drop-shadow-lg`}>
                {wellnessIndex}
              </span>
            </div>
          </div>
          <p className="text-center text-muted-foreground">
            {getFeedbackText(wellnessIndex)}
          </p>
        </CardContent>
      </Card>

      {/* Вкладки с симптомами */}
      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="physical" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="physical">
                <Heart className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="mood">
                <Brain className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="energy">
                <Zap className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="sleep">
                <Moon className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            {/* Физические симптомы */}
            <TabsContent value="physical" className="space-y-4">
              <h3 className="font-medium text-sm">Физическое состояние</h3>
              <div className="flex flex-wrap gap-2">
                {physicalOptions.map(option => (
                  <Badge
                    key={option.id}
                    variant={currentLog.physical_symptoms.includes(option.id) ? 'default' : 'outline'}
                    className="cursor-pointer transition-all hover:scale-105"
                    onClick={() => toggleSelection('physical_symptoms', option.id)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </TabsContent>

            {/* Настроение */}
            <TabsContent value="mood" className="space-y-4">
              <h3 className="font-medium text-sm">Настроение</h3>
              <div className="flex flex-wrap gap-2">
                {moodOptions.map(option => (
                  <Badge
                    key={option.id}
                    variant={currentLog.mood.includes(option.id) ? 'default' : 'outline'}
                    className="cursor-pointer transition-all hover:scale-105"
                    onClick={() => toggleSelection('mood', option.id)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </TabsContent>

            {/* Энергия */}
            <TabsContent value="energy" className="space-y-4">
              <h3 className="font-medium text-sm">Уровень энергии: {currentLog.energy}/5</h3>
              <Slider
                value={[currentLog.energy]}
                onValueChange={([value]) => setCurrentLog({ ...currentLog, energy: value })}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Низкий</span>
                <span>Высокий</span>
              </div>
            </TabsContent>

            {/* Сон и стресс */}
            <TabsContent value="sleep" className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-sm">Качество сна: {currentLog.sleep_quality}/5</h3>
                <Slider
                  value={[currentLog.sleep_quality]}
                  onValueChange={([value]) => setCurrentLog({ ...currentLog, sleep_quality: value })}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-4">
                <h3 className="font-medium text-sm">Уровень стресса: {currentLog.stress_level}/5</h3>
                <Slider
                  value={[currentLog.stress_level]}
                  onValueChange={([value]) => setCurrentLog({ ...currentLog, stress_level: value })}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                />
              </div>
            </TabsContent>
          </Tabs>

          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="w-full mt-6"
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </CardContent>
      </Card>

      {/* История за 7 дней */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">История (7 дней)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between gap-2">
              {history.reverse().map((day) => {
                const date = new Date(day.date);
                const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
                
                return (
                  <div key={day.date} className="flex flex-col items-center gap-2">
                    <span className="text-xs text-muted-foreground">{dayName}</span>
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        day.wellness_index <= 30 ? 'bg-destructive/20 text-destructive' :
                        day.wellness_index <= 60 ? 'bg-yellow-500/20 text-yellow-600' :
                        'bg-green-500/20 text-green-600'
                      }`}
                    >
                      {day.wellness_index}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Symptoms;
