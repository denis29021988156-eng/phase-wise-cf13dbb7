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
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { EnergyGauge } from '@/components/energy/EnergyGauge';
import { EventsImpactSection } from '@/components/energy/EventsImpactSection';
import { EnergyCalculationBreakdown } from '@/components/energy/EnergyCalculationBreakdown';
import { WeekForecast } from '@/components/energy/WeekForecast';

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

const Energy = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Energy breakdown state
  const [energyBreakdown, setEnergyBreakdown] = useState<any>(null);
  const [weekForecast, setWeekForecast] = useState<any[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
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
    { id: 'pain', label: `🤕 ${t('symptoms.pain')}`, value: -15 },
    { id: 'fatigue', label: `😴 ${t('symptoms.fatigue')}`, value: -10 },
    { id: 'energy', label: `💪 ${t('symptoms.energy')}`, value: 15 },
    { id: 'cramps', label: `🩹 ${t('symptoms.cramps')}`, value: -12 },
    { id: 'headache', label: `🤯 ${t('symptoms.headache')}`, value: -10 },
    { id: 'bloating', label: `🎈 ${t('symptoms.bloating')}`, value: -8 }
  ];

  const moodOptions = [
    { id: 'happy', label: `😊 ${t('symptoms.moodHappy')}`, value: 20 },
    { id: 'calm', label: `🧘 ${t('symptoms.moodCalm')}`, value: 15 },
    { id: 'anxious', label: `😰 ${t('symptoms.moodAnxious')}`, value: -15 },
    { id: 'irritable', label: `😡 ${t('symptoms.moodIrritable')}`, value: -12 },
    { id: 'sad', label: `😢 ${t('symptoms.moodSad')}`, value: -10 },
    { id: 'motivated', label: `✨ ${t('symptoms.moodMotivated')}`, value: 18 }
  ];

  // Загрузка истории за последние 7 дней
  useEffect(() => {
    if (user) {
      loadHistory();
      loadTodayLog();
      loadPredictions();
      healthKit.checkAvailability();
      loadEnergyBreakdown();
    }
  }, [user]);

  const loadEnergyBreakdown = async () => {
    if (!user) return;
    
    setLoadingBreakdown(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-today-energy-breakdown');
      
      if (error) {
        console.error('Energy breakdown error:', error);
        throw error;
      }
      
      console.log('Energy breakdown data received:', data);
      setEnergyBreakdown(data);
      
      // Also load week forecast with events
      const { data: forecastData, error: forecastError } = await supabase.functions.invoke('get-week-forecast-with-events');
      if (!forecastError && forecastData) {
        console.log('Week forecast data received:', forecastData);
        setWeekForecast(forecastData.forecast || []);
      } else {
        console.error('Error loading week forecast:', forecastError);
      }
    } catch (error: any) {
      console.error('Error loading energy breakdown:', error);
      toast({
        title: t('symptoms.syncError'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingBreakdown(false);
    }
  };

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
          .maybeSingle();

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
                note: i18n.language === 'en' 
                  ? 'Basic forecast based on cycle phase'
                  : 'Базовый прогноз по фазе цикла'
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
        title: t('symptoms.savedSuccess'),
        description: getFeedbackText(wellnessIndex),
      });
    } catch (error) {
      console.error('Error saving symptoms:', error);
      toast({
        title: t('allEvents.deleteError'),
        description: t('symptoms.saveError'),
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
        title: t('symptoms.syncedSuccess'),
        description: t('symptoms.dataLoadedFromHealth'),
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: t('symptoms.syncError'),
        description: t('symptoms.couldNotLoadHealth'),
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
        title: t('symptoms.unavailable'),
        description: t('symptoms.healthOnlyIOS'),
        variant: 'destructive',
      });
      return;
    }

    const authorized = await healthKit.requestAuthorization();
    
    if (authorized) {
      toast({
        title: t('symptoms.connected'),
        description: t('symptoms.healthConnected'),
      });
    } else {
      toast({
        title: t('symptoms.declined'),
        description: t('symptoms.allowHealthAccess'),
        variant: 'destructive',
      });
    }
  };

  const getFeedbackText = (index: number) => {
    if (i18n.language === 'ru') {
      if (index <= 30) return 'Отдохни сегодня 💧';
      if (index <= 60) return 'Всё стабильно 😊';
      return 'Ты в отличной форме ✨';
    } else {
      if (index <= 30) return 'Rest today 💧';
      if (index <= 60) return 'Everything is stable 😊';
      return 'You\'re in great shape ✨';
    }
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
    const historicalData = history
      .slice()
      .reverse()
      .map((h) => {
        if (!h.date) return null as any;
        const d = new Date(h.date);
        if (isNaN(d.getTime())) return null as any;
        return {
          date: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
          wellness: h.wellness_index,
          type: 'actual',
        };
      })
      .filter(Boolean) as any[];

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {loadingBreakdown ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : energyBreakdown && energyBreakdown.today && energyBreakdown.calculation ? (
        <>
          {/* Desktop Layout with Fixed Sidebars */}
          <div className="hidden lg:grid lg:grid-rows-[60px_1fr_auto] lg:h-screen">
            {/* Header */}
            <header className="border-b border-border bg-card/50 backdrop-blur-sm">
              <div className="h-full flex items-center px-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Gaia Dashboard
                </h1>
              </div>
            </header>

            {/* Main Content Area with Sidebars */}
            <div className="grid grid-cols-[280px_1fr_320px] overflow-hidden">
              {/* LEFT SIDEBAR - Fixed */}
              <aside className="border-r border-border bg-card/30 overflow-y-auto">
                <div className="p-4 space-y-4">
                  <EnergyGauge 
                    score={energyBreakdown.finalEnergy || 3}
                    phase={energyBreakdown.cyclePhase || 'follicular'}
                    date={energyBreakdown.today}
                  />
                  
                  {/* Physical State */}
                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Heart className="h-4 w-4" />
                        Физическое состояние
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {physicalOptions.map(option => (
                          <Badge
                            key={option.id}
                            variant={currentLog.physical_symptoms.includes(option.id) ? 'default' : 'outline'}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleSelection('physical_symptoms', option.id)}
                          >
                            {option.label}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </aside>

              {/* CENTER - Large Energy Graph */}
              <main className="overflow-y-auto p-6">
                <Card className="h-full overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card via-card to-accent/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      Энергетический баланс
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">15 дней истории и 30-дневный прогноз</p>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {isLoadingPredictions ? (
                      <div className="h-[calc(100vh-300px)] flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-foreground font-medium">Загрузка прогноза...</p>
                      </div>
                    ) : history.length === 0 ? (
                      <div className="h-[calc(100vh-300px)] flex flex-col items-center justify-center gap-3 text-center px-4">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                          <Brain className="w-10 h-10 text-primary" />
                        </div>
                        <p className="text-foreground font-medium">Начните добавлять данные</p>
                        <p className="text-sm text-muted-foreground">График появится после первой записи</p>
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(500, window.innerHeight - 350)}>
                          <AreaChart data={getChartData()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                              </linearGradient>
                              <linearGradient id="gradientPredicted" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.2}/>
                                <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0.02}/>
                              </linearGradient>
                              <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity={0.15}/>
                                <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                            <XAxis 
                              dataKey="date" 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                              tickLine={{ stroke: 'hsl(var(--border))' }}
                            />
                            <YAxis 
                              domain={[0, 100]} 
                              ticks={[0, 25, 50, 75, 100]}
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                              tickLine={{ stroke: 'hsl(var(--border))' }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            
                            {/* Confidence band */}
                            <Area
                              type="monotone"
                              dataKey="wellness"
                              data={getChartData().filter(d => d.type === 'predicted')}
                              stroke="none"
                              fill="url(#confidenceBand)"
                              strokeWidth={0}
                            />
                            
                            {/* Actual - Purple solid */}
                            <Area
                              type="monotone"
                              dataKey="wellness"
                              data={getChartData().filter(d => d.type === 'actual')}
                              stroke="hsl(var(--primary))"
                              strokeWidth={3}
                              fill="url(#gradientActual)"
                              dot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                              activeDot={{ r: 7, fill: 'hsl(var(--primary))', strokeWidth: 3, stroke: 'hsl(var(--background))' }}
                            />
                            
                            {/* Predicted - Pink dashed */}
                            <Area
                              type="monotone"
                              dataKey="wellness"
                              data={getChartData().filter(d => d.type === 'predicted')}
                              stroke="hsl(var(--secondary))"
                              strokeWidth={2.5}
                              strokeDasharray="8 4"
                              fill="url(#gradientPredicted)"
                              dot={{ r: 4, fill: 'hsl(var(--secondary))', strokeWidth: 2, stroke: 'hsl(var(--background))', opacity: 0.8 }}
                              activeDot={{ r: 6, fill: 'hsl(var(--secondary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        
                        <div className="flex items-center justify-center gap-8 mt-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-1 rounded-full bg-primary shadow-sm" />
                            <span className="text-sm text-foreground font-medium">Факт</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-1 rounded-full border-2 border-dashed border-secondary" />
                            <span className="text-sm text-foreground font-medium">Прогноз</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-3 rounded bg-muted/50" />
                            <span className="text-xs text-muted-foreground">Диапазон</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </main>

              {/* RIGHT SIDEBAR - Fixed */}
              <aside className="border-l border-border bg-card/30 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {energyBreakdown.events && energyBreakdown.events.length > 0 && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">События сегодня</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <EventsImpactSection
                          events={energyBreakdown.events}
                          cyclePhase={energyBreakdown.cyclePhase || 'follicular'}
                        />
                      </CardContent>
                    </Card>
                  )}
                  
                  <EnergyCalculationBreakdown
                    calculation={energyBreakdown.calculation}
                    confidence={energyBreakdown.confidence || 50}
                  />
                </div>
              </aside>
            </div>

            {/* BOTTOM: Week Forecast - Full Width */}
            <footer className="border-t border-border bg-card/50 overflow-y-auto">
              <div className="p-6">
                {weekForecast && weekForecast.length > 0 && (
                  <WeekForecast forecast={weekForecast} />
                )}
              </div>
            </footer>
          </div>

          {/* Mobile Layout - Vertical */}
          <div className="lg:hidden p-4 pb-24 space-y-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {t('symptoms.title')}
            </h1>
            
            <EnergyGauge 
              score={energyBreakdown.finalEnergy || 3}
              phase={energyBreakdown.cyclePhase || 'follicular'}
              date={energyBreakdown.today}
            />
            
            {energyBreakdown.events && energyBreakdown.events.length > 0 && (
              <EventsImpactSection
                events={energyBreakdown.events}
                cyclePhase={energyBreakdown.cyclePhase || 'follicular'}
              />
            )}
            
            <EnergyCalculationBreakdown
              calculation={energyBreakdown.calculation}
              confidence={energyBreakdown.confidence || 50}
            />
            
            {weekForecast && weekForecast.length > 0 && (
              <WeekForecast forecast={weekForecast} />
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-center text-muted-foreground">Загрузка данных...</p>
        </div>
      )}

    </div>
  );
};

export default Energy;
