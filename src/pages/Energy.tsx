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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart, ReferenceLine } from 'recharts';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { EnergyGauge } from '@/components/energy/EnergyGauge';

import { WeekForecast } from '@/components/energy/WeekForecast';
import { EnergyBalanceCard } from '@/components/energy/EnergyBalanceCard';
import { EnergySidebar } from '@/components/energy/EnergySidebar';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  weight?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  had_sex?: boolean;
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
    wellness_index: 50,
    weight: undefined,
    blood_pressure_systolic: undefined,
    blood_pressure_diastolic: undefined,
    had_sex: false
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
          console.log('Event changed - updating forecast:', payload);
          // Force reload both today's breakdown and week forecast
          await loadEnergyBreakdown();
          // Also reload week forecast explicitly
          try {
            const { data: forecastData, error: forecastError } = await supabase.functions.invoke('get-week-forecast-with-events');
            if (!forecastError && forecastData) {
              console.log('Week forecast updated after event change:', forecastData);
              setWeekForecast(forecastData.forecast || []);
            }
          } catch (error) {
            console.error('Error updating week forecast:', error);
          }
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
    
    // Load all historical data without limit for dynamic chart growth
    const { data } = await supabase
      .from('symptom_logs')
      .select('date, wellness_index')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

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
        wellness_index: data.wellness_index || 50,
        weight: data.weight || undefined,
        blood_pressure_systolic: data.blood_pressure_systolic || undefined,
        blood_pressure_diastolic: data.blood_pressure_diastolic || undefined,
        had_sex: data.had_sex || false
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
          wellness_index: wellnessIndex,
          weight: currentLog.weight,
          blood_pressure_systolic: currentLog.blood_pressure_systolic,
          blood_pressure_diastolic: currentLog.blood_pressure_diastolic,
          had_sex: currentLog.had_sex
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
    today.setHours(0, 0, 0, 0);
    
    // Add today's data point as transition between actual and predicted
    const todayData = {
      date: format(today, 'dd.MM', { locale: ru }),
      wellness: historicalData.length > 0 ? historicalData[historicalData.length - 1].wellness : 50,
      type: 'actual',
    };
    
    // Create a map of future dates to weekForecast data for event-adjusted forecast
    const forecastMap = new Map();
    if (weekForecast && weekForecast.length > 0) {
      weekForecast.forEach((dayForecast: any) => {
        const forecastDate = new Date(dayForecast.date);
        forecastDate.setHours(0, 0, 0, 0);
        const dateKey = format(forecastDate, 'dd.MM', { locale: ru });
        forecastMap.set(dateKey, {
          wellness_with_events: dayForecast.wellness_index,
          base_wellness: dayForecast.base_wellness,
          events_impact: dayForecast.events_impact
        });
      });
    }
    
    const predictedData = predictions.map((p, idx) => {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + idx + 1);
      const dateKey = format(futureDate, 'dd.MM', { locale: ru });
      const forecastData = forecastMap.get(dateKey);
      
      return {
        date: dateKey,
        wellness: p.wellness,
        wellnessWithEvents: forecastData ? forecastData.wellness_with_events : p.wellness,
        type: 'predicted',
        note: p.note
      };
    });

    // Combine all data with proper connection point
    const allData = [...historicalData];
    
    // Add transition point only if we have predictions
    if (predictedData.length > 0) {
      allData.push(todayData);
      allData.push(...predictedData);
    }

    return allData;
  };

  // Calculate average predicted wellness
  const getAveragePrediction = () => {
    if (predictions.length === 0) return null;
    const sum = predictions.reduce((acc, p) => acc + p.wellness, 0);
    return Math.round(sum / predictions.length);
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
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold" style={{ color: isPredicted ? '#8B5CF6' : '#3B82F6' }}>
              {data.wellness}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          {isPredicted && data.wellnessWithEvents && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Event прогноз:</span>
              <span className="text-lg font-bold text-emerald-500">
                {data.wellnessWithEvents}
              </span>
            </div>
          )}
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

  const handleDownloadPDF = async () => {
    try {
      // Validate data
      if (!history || history.length === 0) {
        toast({
          title: 'Нет данных',
          description: 'Недостаточно данных для создания отчета',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Генерация PDF...',
        description: 'Подождите, создаем ваш отчет',
      });

      // Create temporary container for PDF rendering
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '1200px';
      document.body.appendChild(container);

      const reportData = {
        history: history || [],
        predictions: predictions || [],
        physicalSymptoms: currentLog.physical_symptoms || [],
        moodSymptoms: currentLog.mood || [],
        sleepQuality: currentLog.sleep_quality || 3,
        stressLevel: currentLog.stress_level || 3,
      };

      // Create the report HTML element
      const reportDiv = document.createElement('div');
      reportDiv.id = 'weekly-report-pdf';
      reportDiv.style.cssText = `
        width: 1200px;
        height: auto;
        min-height: 800px;
        background: white;
        padding: 60px 80px;
        font-family: Arial, sans-serif;
        color: #0d4d4d;
      `;
      reportDiv.innerHTML = generateReportHTML(reportData);
      container.appendChild(reportDiv);

      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Capture the rendered component
      const element = document.getElementById('weekly-report-pdf');
      if (!element) {
        throw new Error('Report element not found');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200,
      });

      // Create PDF
      const imgWidth = 297; // A4 width in mm (landscape)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Save PDF
      const fileName = `Energy-Report-${format(new Date(), 'dd-MM-yyyy')}.pdf`;
      pdf.save(fileName);

      // Cleanup
      document.body.removeChild(container);

      toast({
        title: 'Готово!',
        description: 'PDF отчет успешно создан',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Ошибка',
        description: `Не удалось создать PDF: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        variant: 'destructive'
      });
    }
  };

  const generateReportHTML = (data: any) => {
    // Calculate monthly averages
    const monthlyData: { [key: string]: { sum: number; count: number } } = {};
    
    if (data.history && data.history.length > 0) {
      data.history.forEach((day: any) => {
        try {
          const monthKey = format(new Date(day.date), 'MMM', { locale: ru });
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { sum: 0, count: 0 };
          }
          monthlyData[monthKey].sum += day.wellness_index;
          monthlyData[monthKey].count += 1;
        } catch (error) {
          // Skip invalid dates
        }
      });
    }

    const monthlyAverages = Object.entries(monthlyData).slice(-5).map(([month, { sum, count }]) => ({
      month,
      avg: (sum / count).toFixed(2),
    }));

    // Calculate health metrics
    const total = data.physicalSymptoms.length + data.moodSymptoms.length;
    const activeCount = data.moodSymptoms.filter((m: string) => ['happy', 'calm', 'motivated'].includes(m)).length;
    const activities = total > 0 ? Math.round((activeCount / total) * 100) : 50;
    const rest = 100 - activities;

    // Get forecast data
    const forecastData = (data.predictions || [])
      .slice(0, 7)
      .map((pred: any) => {
        try {
          return {
            date: format(new Date(pred.date), 'dd.MM', { locale: ru }),
            value: pred.wellness_index || 0,
          };
        } catch (error) {
          // Skip invalid dates
          return null;
        }
      })
      .filter((item): item is { date: string; value: number } => item !== null);

    return `
      <div style="text-align: center; margin-bottom: 50px;">
        <h1 style="font-size: 48px; font-weight: bold; color: #0d5858; margin: 0 0 10px 0; letter-spacing: -1px;">
          Energy, Health & Balance Report
        </h1>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 40px;">
        <!-- Section 1: Energy Consumption Trends -->
        <div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 60px; height: 60px; margin: 0 auto 15px; border: 3px solid #0d5858; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px;">
              💡
            </div>
            <h2 style="font-size: 18px; font-weight: bold; color: #0d4d4d; margin: 0;">Energy Consumption</h2>
            <h3 style="font-size: 18px; font-weight: bold; color: #0d4d4d; margin: 0;">Trends</h3>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 2px solid #0d5858;">
                <th style="padding: 8px 4px; text-align: left; color: #0d5858;">Monthly</th>
                <th style="padding: 8px 4px; text-align: center; color: #0d5858;">Avg</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyAverages.length > 0 ? monthlyAverages.map((row) => `
                <tr style="border-bottom: 1px solid #e0e0e0;">
                  <td style="padding: 12px 4px; font-weight: bold;">${row.month}</td>
                  <td style="padding: 12px 4px; text-align: center;">${row.avg}</td>
                </tr>
              `).join('') : '<tr><td colspan="2" style="padding: 12px; text-align: center;">Нет данных</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Section 2: Health Metrics Overview -->
        <div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 60px; height: 60px; margin: 0 auto 15px; border: 3px solid #0d5858; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px;">
              ❤️
            </div>
            <h2 style="font-size: 18px; font-weight: bold; color: #0d4d4d; margin: 0;">Health Metrics</h2>
            <h3 style="font-size: 18px; font-weight: bold; color: #0d4d4d; margin: 0;">Overview</h3>
          </div>

          <div style="position: relative; width: 200px; height: 200px; margin: 20px auto;">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="none" stroke="#00bcd4" stroke-width="60" stroke-dasharray="${activities * 5.03} 502" transform="rotate(-90 100 100)" />
              <circle cx="100" cy="100" r="80" fill="none" stroke="#ff7875" stroke-width="60" stroke-dasharray="${rest * 5.03} 502" stroke-dashoffset="${-activities * 5.03}" transform="rotate(-90 100 100)" />
            </svg>
            <div style="position: absolute; bottom: -40px; left: 0; right: 0; display: flex; justify-content: center; gap: 20px; font-size: 12px;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 12px; height: 12px; background: #00bcd4;"></div>
                <span>Activities ${activities}%</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 12px; height: 12px; background: #ff7875;"></div>
                <span>Rest ${rest}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: Balance Analysis Forecast -->
        <div>
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="width: 60px; height: 60px; margin: 0 auto 15px; border: 3px solid #0d5858; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px;">
              ⚖️
            </div>
            <h2 style="font-size: 18px; font-weight: bold; color: #0d4d4d; margin: 0;">Balance Analysis</h2>
            <h3 style="font-size: 18px; font-weight: bold; color: #0d4d4d; margin: 0;">Forecast</h3>
          </div>

          ${forecastData.length > 0 ? `
          <div style="width: 100%; height: 180px; position: relative; margin-top: 20px;">
            <svg width="100%" height="180" viewBox="0 0 300 180">
              <line x1="40" y1="20" x2="40" y2="150" stroke="#e0e0e0" stroke-width="1" />
              <line x1="40" y1="150" x2="280" y2="150" stroke="#e0e0e0" stroke-width="1" />
              <polyline
                points="${forecastData.map((d: any, i: number) => {
                  const x = 40 + (i * 35);
                  const y = 150 - (d.value * 1.2);
                  return `${x},${y}`;
                }).join(' ')}"
                fill="none"
                stroke="#00bcd4"
                stroke-width="3"
              />
              ${forecastData.map((d: any, i: number) => {
                const x = 40 + (i * 35);
                const y = 150 - (d.value * 1.2);
                return `<circle cx="${x}" cy="${y}" r="4" fill="#00bcd4" stroke="white" stroke-width="2" />`;
              }).join('')}
              ${forecastData.map((d: any, i: number) => {
                const x = 40 + (i * 35);
                return `<text x="${x}" y="165" text-anchor="middle" font-size="10" fill="#666">${d.date}</text>`;
              }).join('')}
            </svg>
          </div>
          ` : '<div style="text-align: center; padding: 40px; color: #999;">Нет прогнозных данных</div>'}
        </div>
      </div>
    `;
  };

  return (
    <div className="min-h-screen bg-background">
      {loadingBreakdown ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
        </div>
      ) : energyBreakdown && energyBreakdown.today && energyBreakdown.calculation ? (
        <>
          {/* Desktop Layout - Single Scroll */}
          <div className="hidden lg:block">
            <div className="max-w-[98%] mx-auto py-4 px-4">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,15%)_minmax(600px,60%)_minmax(320px,25%)] gap-4">
                {/* COLUMN 1: LEFT SIDEBAR */}
                <aside className="border border-border bg-card/50 rounded-lg p-4">
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

                {/* COLUMN 2: MAIN CONTENT - Graph and forecasts */}
                <main>
                  <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">
                      Энергетический баланс
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {history.length > 0 ? `${history.length} ${history.length === 1 ? 'день' : history.length < 5 ? 'дня' : 'дней'} истории` : 'Нет истории'} и {predictions.length}-дневный прогноз
                    </p>
                  </div>
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
                          <ComposedChart data={getChartData()} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                            
                            {/* Gradient background for actual data */}
                            <Area
                              type="monotone"
                              dataKey="wellness"
                              stroke="none"
                              fill="url(#gradientActual)"
                              fillOpacity={1}
                            />
                            
                            {/* Average prediction line */}
                            {getAveragePrediction() !== null && (
                              <ReferenceLine
                                y={getAveragePrediction()}
                                stroke="#FCD34D"
                                strokeWidth={3}
                                strokeDasharray="0"
                              />
                            )}
                            
                            {/* Main line with dynamic styling */}
                            <Line
                              type="monotone"
                              dataKey="wellness"
                              stroke="#3B82F6"
                              strokeWidth={2.5}
                              connectNulls
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload) return null;
                                const isPredicted = payload.type === 'predicted';
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={isPredicted ? 3 : 4}
                                    fill={isPredicted ? '#8B5CF6' : '#3B82F6'}
                                    strokeWidth={2}
                                    stroke="#fff"
                                  />
                                );
                              }}
                              activeDot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload) return null;
                                const isPredicted = payload.type === 'predicted';
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={isPredicted ? 5 : 6}
                                    fill={isPredicted ? '#8B5CF6' : '#3B82F6'}
                                    strokeWidth={2}
                                    stroke="#fff"
                                  />
                                );
                              }}
                            />
                            
                            {/* Dashed line overlay for predicted section */}
                            <Line
                              type="monotone"
                              dataKey={(entry: any) => entry.type === 'predicted' ? entry.wellness : null}
                              stroke="#8B5CF6"
                              strokeWidth={2.5}
                              strokeDasharray="8 4"
                              connectNulls
                              dot={false}
                            />
                            
                            {/* Event-adjusted forecast line */}
                            <Line
                              type="monotone"
                              dataKey={(entry: any) => entry.type === 'predicted' && entry.wellnessWithEvents ? entry.wellnessWithEvents : null}
                              stroke="#10b981"
                              strokeWidth={2.5}
                              strokeDasharray="8 4"
                              connectNulls
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload || payload.type !== 'predicted' || !payload.wellnessWithEvents) return null;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={3}
                                    fill="#10b981"
                                    strokeWidth={2}
                                    stroke="#fff"
                                  />
                                );
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        
                        <div className="flex items-center justify-center gap-6 mt-3 pb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-sm text-foreground font-medium">Было</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-1.5 rounded-full border-t-2 border-dashed border-purple-500" />
                            <span className="text-sm text-foreground font-medium">Прогноз</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-1.5 rounded-full border-t-2 border-dashed border-emerald-500" />
                            <span className="text-sm text-foreground font-medium">Event прогноз</span>
                          </div>
                          {getAveragePrediction() !== null && (
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-1.5 rounded-full bg-yellow-400" />
                              <span className="text-sm text-foreground font-medium">Среднее</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-center">
                  <Button
                    onClick={() => setIsReportDialogOpen(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Отчет за неделю
                  </Button>
                </div>

                {weekForecast && weekForecast.length > 0 && (
                  <WeekForecast forecast={weekForecast} />
                )}
                  </div>
                </main>

                {/* COLUMN 3: RIGHT SIDEBAR - Wellness info */}
                <aside className="bg-card/30 border border-border rounded-lg p-4">
                  <div className="space-y-4">
                <EnergyBalanceCard
                  baseEnergy={energyBreakdown.calculation.base}
                  eventsImpact={energyBreakdown.calculation.events}
                  sleepModifier={energyBreakdown.calculation.sleep}
                  stressModifier={energyBreakdown.calculation.stress}
                  wellnessModifier={energyBreakdown.calculation.wellness}
                  finalEnergy={energyBreakdown.finalEnergy}
                  events={energyBreakdown.events || []}
                  cyclePhase={energyBreakdown.cyclePhase || 'follicular'}
                />


                {/* Energy Spent Card */}
                <Card className="border-2 bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="w-5 h-5 text-red-600 dark:text-red-400" />
                      Затрачено энергии
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-4xl font-bold text-red-600 dark:text-red-400">
                        {currentLog.physical_symptoms.reduce((total, symptomId) => {
                          const symptom = physicalOptions.find(s => s.id === symptomId);
                          return total + Math.abs(symptom?.value || 0);
                        }, 0)}
                      </span>
                      <span className="text-sm text-muted-foreground">баллов</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Низкий</span>
                        <span className="text-muted-foreground">0-2</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Высокий</span>
                        <span className="text-muted-foreground">3-5</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                  </div>
                </aside>
              </div>
            </div>
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
              wellnessModifier={energyBreakdown.calculation.wellness}
              finalEnergy={energyBreakdown.finalEnergy}
              events={energyBreakdown.events || []}
              cyclePhase={energyBreakdown.cyclePhase || 'follicular'}
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
