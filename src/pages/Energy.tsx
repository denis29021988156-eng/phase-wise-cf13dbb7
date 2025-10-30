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
import { Heart, Brain, Zap, Moon, RefreshCw, Upload, BarChart3, Share2, Download } from 'lucide-react';
import { useHealthKit } from '@/hooks/useHealthKit';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { EnergyGauge } from '@/components/energy/EnergyGauge';
import { EventsImpactSection } from '@/components/energy/EventsImpactSection';
import { EnergyCalculationBreakdown } from '@/components/energy/EnergyCalculationBreakdown';
import { WeekForecast } from '@/components/energy/WeekForecast';
import { SymptomsInput } from '@/components/energy/SymptomsInput';
import { EnergyBalanceCard } from '@/components/energy/EnergyBalanceCard';
import { EnergySidebar } from '@/components/energy/EnergySidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // Данные для выбора
  const physicalOptions = [
    { id: 'pain', label: `🤕 ${t('symptoms.pain')}`, value: -15 },
    { id: 'fatigue', label: `😴 ${t('symptoms.fatigue')}`, value: -10 },
    { id: 'energy', label: `💪 ${t('symptoms.energy')}`, value: 15 },
    { id: 'cramps', label: `🩹 ${t('symptoms.cramps')}`, value: -12 },
    { id: 'headache', label: `🤯 ${t('symptoms.headache')}`, value: -10 },
    { id: 'bloating', label: `🎈 ${t('symptoms.bloating')}`, value: -8 },
    { id: 'nausea', label: `🤢 ${t('symptoms.nausea')}`, value: -12 },
    { id: 'insomnia', label: `😵 ${t('symptoms.insomnia')}`, value: -14 },
    { id: 'dizziness', label: `😵‍💫 ${t('symptoms.dizziness')}`, value: -10 },
    { id: 'breast_tenderness', label: `💗 ${t('symptoms.breastTenderness')}`, value: -8 },
    { id: 'swelling', label: `🫧 ${t('symptoms.swelling')}`, value: -7 },
    { id: 'acne', label: `🔴 ${t('symptoms.acne')}`, value: -6 },
    { id: 'increased_appetite', label: `🍽️ ${t('symptoms.increasedAppetite')}`, value: -5 },
    { id: 'back_pain', label: `🦴 ${t('symptoms.backPain')}`, value: -11 },
    { id: 'muscle_aches', label: `💢 ${t('symptoms.muscleAches')}`, value: -9 }
  ];

  const moodOptions = [
    { id: 'happy', label: `😊 ${t('symptoms.moodHappy')}`, value: 20 },
    { id: 'calm', label: `🧘 ${t('symptoms.moodCalm')}`, value: 15 },
    { id: 'anxious', label: `😰 ${t('symptoms.moodAnxious')}`, value: -15 },
    { id: 'irritable', label: `😡 ${t('symptoms.moodIrritable')}`, value: -12 },
    { id: 'sad', label: `😢 ${t('symptoms.moodSad')}`, value: -10 },
    { id: 'motivated', label: `✨ ${t('symptoms.moodMotivated')}`, value: 18 }
  ];

  // Загрузка данных только при первом монтировании
  useEffect(() => {
    if (user && !hasLoadedInitialData) {
      loadHistory();
      loadTodayLog();
      loadPredictions();
      healthKit.checkAvailability();
      loadEnergyBreakdown();
      setHasLoadedInitialData(true);
    }
  }, [user]);

  // Real-time подписка на изменения данных
  useEffect(() => {
    if (!user) return;

    // Подписка на изменения симптомов
    const symptomsChannel = supabase
      .channel('symptom-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'symptom_logs',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Symptom log changed:', payload);
          await loadHistory();
          await loadTodayLog();
          await loadPredictions();
          await loadEnergyBreakdown();
        }
      )
      .subscribe();

    // Подписка на изменения событий
    const eventsChannel = supabase
      .channel('event-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Event changed:', payload);
          await loadEnergyBreakdown();
        }
      )
      .subscribe();

    // Подписка на изменения профиля и цикла
    const profileChannel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Profile changed:', payload);
          await loadPredictions();
        }
      )
      .subscribe();

    const cycleChannel = supabase
      .channel('cycle-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_cycles',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Cycle changed:', payload);
          await loadPredictions();
          await loadEnergyBreakdown();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(symptomsChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(cycleChannel);
    };
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
      // Real-time подписка автоматически обновит данные
      
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

  const getChartData = () => {
    const historicalData = history
      .slice()
      .reverse()
      .map((h) => {
        if (!h.date) return null as any;
        // Parse date as UTC to avoid timezone issues
        const dateParts = h.date.split('-');
        const d = new Date(Date.UTC(
          parseInt(dateParts[0]), 
          parseInt(dateParts[1]) - 1, 
          parseInt(dateParts[2])
        ));
        if (isNaN(d.getTime())) return null as any;
        return {
          date: format(d, 'dd.MM', { locale: ru }),
          wellness: h.wellness_index,
          type: 'actual',
        };
      })
      .filter(Boolean) as any[];

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    
    const predictedData = predictions.map((p, idx) => {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + idx + 1);
      return {
        date: format(futureDate, 'dd.MM', { locale: ru }),
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
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-2 p-4 rounded-2xl shadow-2xl animate-scale-in" style={{ borderColor: isPredicted ? '#8B5CF6' : '#3B82F6' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: isPredicted ? '#8B5CF6' : '#3B82F6' }} />
            <p className="font-semibold text-foreground">{data.date}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold" style={{ color: isPredicted ? '#8B5CF6' : '#3B82F6' }}>
              {data.wellness}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          {isPredicted && data.note && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
              💡 {data.note}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const wellnessIndex = calculateWellnessIndex(currentLog);

  const handleShareReport = () => {
    toast({
      title: 'Ссылка скопирована!',
      description: 'Скопируйте ссылку: gaia.ru?report=123',
    });
  };

  const handleDownloadPDF = () => {
    try {
      // Prepare report data
      const reportDate = new Date().toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      
      // Get last 7 days of history
      const last7Days = history.slice(-7);
      const avgWellness = last7Days.length > 0 
        ? Math.round(last7Days.reduce((sum, day) => sum + day.wellness_index, 0) / last7Days.length)
        : 0;
      
      const maxWellness = last7Days.length > 0 
        ? Math.max(...last7Days.map(d => d.wellness_index))
        : 0;
      
      const maxDay = last7Days.find(d => d.wellness_index === maxWellness);
      
      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Энергетический отчет - ${reportDate}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto;
              color: #333;
            }
            h1 { 
              color: #2E8B57; 
              border-bottom: 3px solid #2E8B57; 
              padding-bottom: 10px;
              margin-bottom: 30px;
            }
            h2 { 
              color: #555; 
              margin-top: 30px;
              font-size: 20px;
            }
            .stat { 
              background: #f5f5f5; 
              padding: 15px; 
              margin: 10px 0; 
              border-radius: 8px;
              border-left: 4px solid #2E8B57;
            }
            .stat strong { 
              color: #2E8B57; 
              font-size: 24px;
            }
            .event-list {
              margin: 20px 0;
            }
            .event-item {
              padding: 10px;
              margin: 5px 0;
              background: #fff;
              border: 1px solid #ddd;
              border-radius: 5px;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #eee;
              text-align: center;
              color: #999;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>📊 Ваш энергетический отчет</h1>
          <p><strong>Дата формирования:</strong> ${reportDate}</p>
          
          <h2>Статистика за последние 7 дней</h2>
          
          <div class="stat">
            <p><strong>${avgWellness}/100</strong></p>
            <p>Средний уровень энергии</p>
          </div>
          
          <div class="stat">
            <p><strong>${maxWellness}/100</strong></p>
            <p>Пик энергии${maxDay ? ` (${new Date(maxDay.date).toLocaleDateString('ru-RU', { weekday: 'long' })})` : ''}</p>
          </div>
          
          ${energyBreakdown && energyBreakdown.events && energyBreakdown.events.length > 0 ? `
          <h2>События сегодня</h2>
          <div class="event-list">
            ${energyBreakdown.events.map(event => `
              <div class="event-item">
                <strong>${event.title}</strong><br>
                <span style="color: ${event.energyImpact < 0 ? '#dc2626' : '#16a34a'}">
                  Влияние на энергию: ${event.energyImpact > 0 ? '+' : ''}${event.energyImpact} баллов
                </span>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${weekForecast && weekForecast.length > 0 ? `
          <h2>Прогноз на неделю</h2>
          <div class="event-list">
            ${weekForecast.slice(0, 7).map(day => `
              <div class="event-item">
                <strong>${new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</strong><br>
                Прогноз энергии: <strong style="color: #2E8B57">${day.wellness_index}/100</strong><br>
                Фаза цикла: ${day.cycle_phase === 'menstrual' ? 'Менструация' : day.cycle_phase === 'follicular' ? 'Фолликулярная' : day.cycle_phase === 'ovulation' ? 'Овуляция' : 'Лютеиновая'}
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          <div class="footer">
            <p>Сгенерировано приложением CycleON</p>
            <p>Для получения персональных рекомендаций обратитесь к вашему консультанту</p>
          </div>
        </body>
        </html>
      `;
      
      // Create a new window and print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = () => {
          printWindow.print();
        };
        
        toast({
          title: 'PDF генерируется...',
          description: 'Откроется окно печати для сохранения в PDF',
        });
      } else {
        throw new Error('Не удалось открыть окно печати');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать PDF. Проверьте разрешения браузера.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {loadingBreakdown ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : energyBreakdown && energyBreakdown.today && energyBreakdown.calculation ? (
        <>
          {/* Desktop Layout with Sidebar */}
          <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:h-screen lg:overflow-hidden">
            {/* LEFT SIDEBAR - Fixed scrollable */}
            <aside className="border-r border-border bg-card/50">
              <EnergySidebar
                wellnessIndex={wellnessIndex}
                currentLog={currentLog}
                onUpdate={setCurrentLog}
                onSave={handleSave}
                loading={loading}
                physicalOptions={physicalOptions}
                moodOptions={moodOptions}
                phase={energyBreakdown.cyclePhase || 'follicular'}
              />
            </aside>

            {/* MAIN CONTENT - Graph and info */}
            <main className="overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Энергетический баланс
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">15 дней истории и 30-дневный прогноз</p>
                  </div>
                  <Button
                    onClick={() => setIsReportDialogOpen(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Отчет за неделю
                  </Button>
                </div>

                <Card className="w-full overflow-hidden border shadow-lg bg-card">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <p className="text-xs text-muted-foreground">График энергии</p>
                  </CardHeader>
                  <CardContent className="p-0">
                     {isLoadingPredictions ? (
                      <div className="h-[250px] flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-sm text-foreground font-medium">Загрузка прогноза...</p>
                      </div>
                    ) : history.length === 0 ? (
                      <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                          <Brain className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-sm text-foreground font-medium">Начните добавлять данные</p>
                        <p className="text-xs text-muted-foreground">График появится после первой записи</p>
                      </div>
                     ) : (
                      <>
                        <ResponsiveContainer width="100%" height={400}>
                          <AreaChart data={getChartData()} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gradientActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4}/>
                                <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.2}/>
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05}/>
                              </linearGradient>
                              <linearGradient id="gradientPredicted" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                                <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.15}/>
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.2} />
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
                            
                            {/* Actual - Solid Blue line */}
                            <Area
                              type="monotone"
                              dataKey="wellness"
                              data={getChartData().filter(d => d.type === 'actual')}
                              stroke="#3B82F6"
                              strokeWidth={2.5}
                              fill="url(#gradientActual)"
                              dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 6, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                            />
                            
                            {/* Predicted - Dashed Purple line */}
                            <Area
                              type="monotone"
                              dataKey="wellness"
                              data={getChartData().filter(d => d.type === 'predicted')}
                              stroke="#8B5CF6"
                              strokeWidth={2.5}
                              strokeDasharray="8 4"
                              fill="url(#gradientPredicted)"
                              dot={{ r: 3, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 5, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        
                        <div className="flex items-center justify-center gap-8 mt-3 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-sm text-foreground font-medium">Было</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-1.5 rounded-full border-t-2 border-dashed border-purple-500" />
                            <span className="text-sm text-foreground font-medium">Прогноз</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Additional Info Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <EnergyBalanceCard
                    baseEnergy={energyBreakdown.calculation.base}
                    eventsImpact={energyBreakdown.calculation.events}
                    sleepModifier={energyBreakdown.calculation.sleep}
                    stressModifier={energyBreakdown.calculation.stress}
                    finalEnergy={energyBreakdown.finalEnergy}
                    events={energyBreakdown.events || []}
                  />
                  
                  <EnergyCalculationBreakdown
                    calculation={energyBreakdown.calculation}
                    confidence={energyBreakdown.confidence || 50}
                  />
                </div>

                {energyBreakdown.events && energyBreakdown.events.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm">События сегодня</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <EventsImpactSection
                        events={energyBreakdown.events}
                        cyclePhase={energyBreakdown.cyclePhase || 'follicular'}
                      />
                    </CardContent>
                  </Card>
                )}

                {weekForecast && weekForecast.length > 0 && (
                  <WeekForecast forecast={weekForecast} />
                )}
              </div>
            </main>
          </div>

          {/* Mobile Layout - Vertical */}
          <div className="lg:hidden p-4 pb-24 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                {t('symptoms.title')}
              </h1>
              <Button
                onClick={() => setIsReportDialogOpen(true)}
                size="sm"
                className="bg-[#2E8B57] hover:bg-[#267347] text-white"
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
            </div>
            
            <EnergyGauge 
              score={wellnessIndex}
              phase={energyBreakdown.cyclePhase || 'follicular'}
              date={energyBreakdown.today}
            />
            
            <EnergyBalanceCard
              baseEnergy={energyBreakdown.calculation.base}
              eventsImpact={energyBreakdown.calculation.events}
              sleepModifier={energyBreakdown.calculation.sleep}
              stressModifier={energyBreakdown.calculation.stress}
              finalEnergy={energyBreakdown.finalEnergy}
              events={energyBreakdown.events || []}
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

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-[3px] border-blue-200/80 dark:border-blue-400/40 shadow-[0_0_50px_rgba(147,197,253,0.5)] dark:shadow-[0_0_50px_rgba(147,197,253,0.3)] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Ваш энергетический отчет готов!
            </DialogTitle>
            <DialogDescription className="pt-6 text-base">
              <p className="text-foreground/80 mb-4">За последние 7 дней вы:</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">⚡</span>
                  </div>
                  <span className="text-foreground font-medium">Пик энергии: 8/10 (вторник)</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">📊</span>
                  </div>
                  <span className="text-foreground font-medium">Самый продуктивный день: среда</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">🌟</span>
                  </div>
                  <span className="text-foreground font-medium">Лучший восстановитель: прогулка</span>
                </div>
              </div>
              <p className="mt-6 text-center font-semibold text-foreground">
                Поделитесь своим прогрессом!
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-3 mt-2">
            <Button
              variant="outline"
              onClick={handleShareReport}
              className="w-full sm:w-auto border-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Поделиться в соцсетях
            </Button>
            <Button
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto bg-[#2E8B57] hover:bg-[#267347] text-white shadow-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              Скачать PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Energy;
