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
import { Heart, Brain, Zap, Moon, RefreshCw, Upload } from 'lucide-react';
import { useHealthKit } from '@/hooks/useHealthKit';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

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
  const healthKit = useHealthKit();
  
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
  const [syncing, setSyncing] = useState(false);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

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
    loadPredictions();
    healthKit.checkAvailability();
  }, [user]);

  const loadPredictions = async () => {
    if (!user) return;
    
    setIsLoadingPredictions(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if we have cached predictions for today
      const { data: cachedPrediction } = await supabase
        .from('wellness_predictions')
        .select('predictions, prediction_date')
        .eq('user_id', user.id)
        .eq('prediction_date', today)
        .maybeSingle();

      if (cachedPrediction) {
        console.log('Using cached predictions from', cachedPrediction.prediction_date);
        setPredictions(cachedPrediction.predictions as any[]);
        setIsLoadingPredictions(false);
        return;
      }

      // No cache, generate new predictions
      console.log('Generating new predictions...');
      const session = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('predict-wellness', {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error from predict-wellness:', error);
        throw error;
      }
      
      if (data?.predictions) {
        setPredictions(data.predictions);
        
        // Cache the predictions
        await supabase
          .from('wellness_predictions')
          .upsert({
            user_id: user.id,
            prediction_date: today,
            predictions: data.predictions
          }, {
            onConflict: 'user_id,prediction_date'
          });
        
        console.log('Predictions cached successfully');
      }
    } catch (error) {
      console.error('Error loading predictions:', error);
      // Fallback to simple predictions
      try {
        const { data: cycle } = await supabase
          .from('user_cycles')
          .select('start_date, cycle_length, menstrual_length')
          .eq('user_id', user.id)
          .single();

        if (cycle) {
          const today = new Date();
          const cycleStart = new Date(cycle.start_date);
          const daysSinceStart = Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
          
          const fallbackPredictions = Array.from({ length: 30 }, (_, i) => {
            const cycleDay = ((daysSinceStart + i + 1) % (cycle.cycle_length || 28)) + 1;
            let wellness = 50;
            
            if (cycleDay <= (cycle.menstrual_length || 5)) {
              wellness = 40 + Math.random() * 15;
            } else if (cycleDay <= 13) {
              wellness = 60 + Math.random() * 20;
            } else if (cycleDay <= 15) {
              wellness = 75 + Math.random() * 20;
            } else {
              wellness = 45 + Math.random() * 25;
            }
            
            return {
              day: i + 1,
              wellness: Math.round(wellness),
              note: 'Базовый прогноз по фазе цикла'
            };
          });
          
          setPredictions(fallbackPredictions);
        }
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
      }
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  const invalidatePredictionCache = async () => {
    if (!user) return;
    
    try {
      // Delete cached predictions to force refresh
      await supabase
        .from('wellness_predictions')
        .delete()
        .eq('user_id', user.id);
      
      console.log('Prediction cache invalidated');
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('symptom_logs')
      .select('date, wellness_index')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(15); // Changed from 7 to 15 for chart

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
      
      // Invalidate prediction cache and reload predictions
      await invalidatePredictionCache();
      await loadPredictions();
      
      // Синхронизация с Apple Health если доступно
      if (healthKit.isAvailable && healthKit.hasPermissions) {
        await healthKit.writeWellnessIndex(wellnessIndex);
      }
      
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

  // Синхронизация с Apple Health
  const handleSyncFromHealth = async () => {
    setSyncing(true);
    
    try {
      // Запрос разрешений если еще не получены
      if (!healthKit.hasPermissions) {
        const authorized = await healthKit.requestAuthorization();
        if (!authorized) {
          toast({
            title: 'Нет доступа',
            description: 'Разрешите доступ к Apple Health в настройках',
            variant: 'destructive',
          });
          return;
        }
      }

      // Получение данных из Health
      const healthData = await healthKit.syncFromHealth();
      
      // Обновление текущих данных
      const updated = { ...currentLog };
      if (healthData.sleepQuality) updated.sleep_quality = healthData.sleepQuality;
      if (healthData.stressLevel) updated.stress_level = healthData.stressLevel;
      
      setCurrentLog(updated);
      
      toast({
        title: 'Синхронизировано ✅',
        description: 'Данные из Apple Health загружены',
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Ошибка синхронизации',
        description: 'Не удалось загрузить данные из Apple Health',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectHealth = async () => {
    const available = await healthKit.checkAvailability();
    
    if (!available) {
      toast({
        title: 'Недоступно',
        description: 'Apple Health доступно только на iOS',
        variant: 'destructive',
      });
      return;
    }

    const authorized = await healthKit.requestAuthorization();
    
    if (authorized) {
      toast({
        title: 'Подключено! 🎉',
        description: 'Apple Health успешно подключено',
      });
    } else {
      toast({
        title: 'Отклонено',
        description: 'Разрешите доступ к Apple Health в настройках',
        variant: 'destructive',
      });
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

  const getChartData = () => {
    const historicalData = history.slice().reverse().map(h => ({
      date: new Date(h.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      wellness: h.wellness_index,
      type: 'actual'
    }));

    const today = new Date();
    const predictedData = predictions.map((p, idx) => {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + idx + 1);
      return {
        date: futureDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        wellness: p.wellness,
        type: 'predicted',
        note: p.note
      };
    });

    return [...historicalData, ...predictedData];
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPredicted = data.type === 'predicted';
      
      return (
        <div className="bg-white/95 backdrop-blur-sm border-2 border-purple-200 p-4 rounded-2xl shadow-2xl animate-scale-in">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${isPredicted ? 'bg-pink-400' : 'bg-purple-500'}`} />
            <p className="font-semibold text-[#374151]">{data.date}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
              {data.wellness}
            </span>
            <span className="text-sm text-gray-500">/ 100</span>
          </div>
          {isPredicted && data.note && (
            <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-purple-100">
              💡 {data.note}
            </p>
          )}
        </div>
      );
    }
    return null;
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

          {/* Apple Health интеграция */}
          <div className="flex gap-2 mt-6">
            {!healthKit.hasPermissions ? (
              <Button 
                onClick={handleConnectHealth}
                variant="outline"
                className="flex-1"
              >
                <Heart className="h-4 w-4 mr-2" />
                Подключить Apple Health
              </Button>
            ) : (
              <Button 
                onClick={handleSyncFromHealth}
                disabled={syncing}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Синхронизация...' : 'Загрузить из Health'}
              </Button>
            )}
          </div>

          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="w-full mt-4"
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </CardContent>
      </Card>

      {/* График энергетического баланса */}
      <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-[#FDFCFB] to-white animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            Энергетический баланс
          </CardTitle>
          <p className="text-sm text-[#374151] mt-1">Ваша ресурсность за последние 15 дней и прогноз на 30 дней</p>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoadingPredictions ? (
            <div className="h-80 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin"></div>
              <p className="text-[#374151] font-medium">Загрузка прогноза...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="h-80 flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                <Brain className="w-10 h-10 text-purple-500" />
              </div>
              <p className="text-[#374151] font-medium">Начните добавлять данные</p>
              <p className="text-sm text-gray-500">График появится после сохранения первой записи</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#C4B5FD" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="gradientPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F472B6" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#FBCFE8" stopOpacity={0.05}/>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" strokeOpacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    ticks={[0, 25, 50, 75, 100]}
                    stroke="#9CA3AF"
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    tickLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#C4B5FD', strokeWidth: 2, strokeDasharray: '5 5' }} />
                  
                  {/* Фактические данные */}
                  <Area
                    type="monotone"
                    dataKey="wellness"
                    data={getChartData().filter(d => d.type === 'actual')}
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    fill="url(#gradientActual)"
                    dot={{ r: 5, fill: '#8B5CF6', strokeWidth: 2, stroke: 'white', filter: 'url(#glow)' }}
                    activeDot={{ r: 7, fill: '#8B5CF6', strokeWidth: 3, stroke: 'white' }}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                  
                  {/* Прогноз */}
                  <Area
                    type="monotone"
                    dataKey="wellness"
                    data={getChartData().filter(d => d.type === 'predicted')}
                    stroke="#F472B6"
                    strokeWidth={2.5}
                    strokeDasharray="8 4"
                    fill="url(#gradientPredicted)"
                    dot={{ r: 4, fill: '#F472B6', strokeWidth: 2, stroke: 'white', opacity: 0.7 }}
                    activeDot={{ r: 6, fill: '#F472B6', strokeWidth: 2, stroke: 'white' }}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
              
              <div className="flex items-center justify-center gap-8 mt-6 px-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-1 rounded-full bg-gradient-to-r from-purple-500 to-purple-300 shadow-sm" />
                  <span className="text-sm text-[#374151] font-medium">Фактические данные</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-1 rounded-full border-2 border-dashed border-pink-400" />
                  <span className="text-sm text-[#374151] font-medium">Прогноз ИИ</span>
                </div>
              </div>
            </>
          )}
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
