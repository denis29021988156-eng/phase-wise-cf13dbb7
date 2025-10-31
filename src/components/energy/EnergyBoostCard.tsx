import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Flame, Calendar, Loader2 } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface BoostRecommendation {
  eventId: string;
  eventTitle: string;
  currentDayEnergy: number;
  energyCost: number;
  currentDate: string;
  suggestedSlots: Array<{
    date: string;
    energy: number;
  }>;
}

interface EnergyBoostCardProps {
  userId: string;
  weekForecast: any[];
  onEventMoved?: () => void;
}

export function EnergyBoostCard({ userId, weekForecast, onEventMoved }: EnergyBoostCardProps) {
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const [recommendation, setRecommendation] = useState<BoostRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    console.log('🔥 Boost Card: userId=', userId, 'weekForecast=', weekForecast);
    if (userId && weekForecast.length > 0) {
      console.log('🔥 Boost Card: Starting findBoostCandidate');
      findBoostCandidate();
    } else {
      console.log('🔥 Boost Card: Not running - missing data');
    }
  }, [userId, weekForecast]);

  const findBoostCandidate = async () => {
    try {
      setLoading(true);
      console.log('🔥 Finding boost candidate, weekForecast:', weekForecast);

      // 1. Найти дни с перегрузкой (wellness_index < 55)
      const overloadedDays = weekForecast.filter(d => d.wellness_index < 55);
      console.log('🔥 Overloaded days (<55):', overloadedDays);
      
      if (overloadedDays.length === 0) {
        console.log('🔥 No overloaded days found - hiding boost');
        setRecommendation(null);
        return;
      }

      // 2. Получить события из перегруженных дней
      const overloadedDates = overloadedDays.map(d => d.date);
      
      // Создаем фильтр для start_time в нужных датах
      const startDateFilters = overloadedDates.map(date => `start_time.gte.${date}T00:00:00,start_time.lt.${date}T23:59:59`);
      
      const { data: eventsRaw, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', `${overloadedDates[0]}T00:00:00`)
        .order('start_time');

      if (error) throw error;
      const events = (eventsRaw as any[]) || [];
      console.log('🔥 Events from DB:', events);
      
      if (!events || events.length === 0) {
        console.log('🔥 No events found - hiding boost');
        setRecommendation(null);
        return;
      }

      // Фильтруем события по перегруженным датам
      const filteredEvents = events.filter(event => {
        const eventDate = event.start_time.split('T')[0];
        return overloadedDates.includes(eventDate);
      });
      console.log('🔥 Filtered events for overloaded dates:', filteredEvents);

      if (filteredEvents.length === 0) {
        console.log('🔥 No events in overloaded days - hiding boost');
        setRecommendation(null);
        return;
      }

      // 3. Рассчитать energyCost для каждого события
      const eventsWithCost = filteredEvents.map((event) => {
        const eventDate = event.start_time.split('T')[0];
        const dayData = weekForecast.find(d => d.date === eventDate);
        
        // Вычислить длительность в минутах
        const startTime = new Date(event.start_time).getTime();
        const endTime = new Date(event.end_time).getTime();
        const durationMinutes = (endTime - startTime) / (1000 * 60);
        
        // Найти влияние этого события на энергию
        const eventImpact = dayData?.events?.find((e: any) => e.name === event.title)?.impact || 0;
        
        console.log('🔥 Event:', event.title, 'dayData:', dayData, 'eventImpact:', eventImpact, 'events in day:', dayData?.events);
        
        return {
          ...event,
          eventDate,
          durationMinutes,
          energyCost: Math.abs(eventImpact),
          currentDayEnergy: dayData?.wellness_index || 50
        };
      });
      console.log('🔥 Events with cost:', eventsWithCost);

      // 4. Фильтр: только события с energyCost > 5 и длительностью <= 180 минут
      const movableEvents = eventsWithCost.filter(e => {
        return e.energyCost > 5 && e.durationMinutes <= 180;
      });
      console.log('🔥 Movable events (cost>5, duration<=180min):', movableEvents);

      if (movableEvents.length === 0) {
        console.log('🔥 No movable events - hiding boost');
        setRecommendation(null);
        return;
      }

      // 5. Выбрать самое энергозатратное событие
      const mostCostlyEvent = movableEvents.reduce((max, event) => 
        event.energyCost > max.energyCost ? event : max
      );
      console.log('🔥 Most costly event:', mostCostlyEvent);

      // 6. Найти дни с высоким запасом энергии (wellness_index > 70)
      const highEnergyDays = weekForecast.filter(d => 
        d.wellness_index > 70 && 
        d.date > mostCostlyEvent.eventDate // только будущие дни
      );
      console.log('🔥 High energy days (>70):', highEnergyDays);

      if (highEnergyDays.length === 0) {
        console.log('🔥 No high energy days available - hiding boost');
        setRecommendation(null);
        return;
      }

      // 7. Взять топ-3 лучших дня
      const topSlots = highEnergyDays
        .sort((a, b) => b.wellness_index - a.wellness_index)
        .slice(0, 3)
        .map(day => ({
          date: day.date,
          energy: day.wellness_index
        }));

      const recommendation = {
        eventId: mostCostlyEvent.id,
        eventTitle: mostCostlyEvent.title,
        currentDayEnergy: mostCostlyEvent.currentDayEnergy,
        energyCost: mostCostlyEvent.energyCost,
        currentDate: mostCostlyEvent.eventDate,
        suggestedSlots: topSlots
      };
      console.log('🔥 Final recommendation:', recommendation);
      setRecommendation(recommendation);

    } catch (error) {
      console.error('🔥 Error finding boost candidate:', error);
      setRecommendation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveEvent = async () => {
    if (!recommendation || recommendation.suggestedSlots.length === 0) return;

    try {
      setMoving(true);
      const targetSlot = recommendation.suggestedSlots[0];

      // Получить детали события
      const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', recommendation.eventId)
        .single();

      if (fetchError) throw fetchError;

      // Подготовить новые даты
      const oldStartTime = parseISO(event.start_time);
      const newDate = parseISO(targetSlot.date);
      
      // Сохранить время, поменять только дату
      newDate.setHours(oldStartTime.getHours());
      newDate.setMinutes(oldStartTime.getMinutes());

      const newStartTime = newDate.toISOString();
      // Вычислить длительность из старых start_time и end_time
      const oldEndTime = parseISO(event.end_time);
      const durationMs = oldEndTime.getTime() - oldStartTime.getTime();
      const newEndTime = new Date(newDate.getTime() + durationMs).toISOString();

      // Обновить событие
      const { error: updateError } = await supabase
        .from('events')
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
        })
        .eq('id', recommendation.eventId);

      if (updateError) throw updateError;

      toast({
        title: i18n.language === 'ru' ? '✅ Событие перенесено' : '✅ Event moved',
        description: i18n.language === 'ru' 
          ? `Событие перенесено на ${format(parseISO(targetSlot.date), 'd MMMM', { locale: ru })}. Энергия сбалансирована 💪`
          : `Event moved to ${format(parseISO(targetSlot.date), 'MMMM d')}. Energy balanced 💪`,
      });

      setHidden(true);
      onEventMoved?.();

    } catch (error) {
      console.error('Error moving event:', error);
      toast({
        title: i18n.language === 'ru' ? 'Ошибка' : 'Error',
        description: i18n.language === 'ru' 
          ? 'Не удалось перенести событие. Попробуйте позже.'
          : 'Failed to move event. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setMoving(false);
    }
  };

  const handleSkip = () => {
    setHidden(true);
    // Сохранить в localStorage чтобы не показывать сегодня для конкретного события
    const today = new Date().toISOString().split('T')[0];
    if (recommendation) {
      localStorage.setItem(`boost-hidden-${userId}-${recommendation.eventId}-${today}`, '1');
    }
  };

  // Проверить, не скрыто ли сегодня для именно этого события
  useEffect(() => {
    if (!recommendation) return;
    const today = new Date().toISOString().split('T')[0];
    const key = `boost-hidden-${userId}-${recommendation.eventId}-${today}`;
    const hiddenFlag = localStorage.getItem(key);
    setHidden(hiddenFlag === '1');
  }, [userId, recommendation?.eventId]);

  if (loading) {
    return (
      <Card className="border-2 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Boost 🔥
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              {i18n.language === 'ru' ? 'AI анализирует ваш календарь…' : 'AI analyzing your calendar…'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Показываем блок всегда
  if (hidden) {
    const today = new Date().toISOString().split('T')[0];
    const key = recommendation ? `boost-hidden-${userId}-${recommendation.eventId}-${today}` : '';
    const handleUnhide = () => {
      if (key) localStorage.removeItem(key);
      setHidden(false);
    };
    return (
      <Card className="border-2 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Boost 🔥
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {i18n.language === 'ru' ? 'Скрыто до завтра' : 'Hidden until tomorrow'}
            </p>
            <Button size="sm" variant="outline" onClick={handleUnhide}>
              {i18n.language === 'ru' ? 'Показать' : 'Show'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendation) {
    return (
      <Card className="border-2 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Boost 🔥
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">
              {i18n.language === 'ru'
                ? 'Перегруженных дней пока нет. Мы подскажем, когда появятся варианты переноса.'
                : 'No overloaded days yet. We will suggest moves when options appear.'}
            </p>
            <Button size="sm" onClick={findBoostCandidate}>
              {i18n.language === 'ru' ? 'Обновить' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  console.log('🔥 Rendering boost card with recommendation:', recommendation);

  return (
    <Card className="border-2 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          Boost 🔥
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Рекомендация */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            💬 {i18n.language === 'ru' ? 'Рекомендация дня:' : 'Daily recommendation:'}
          </p>
          <p className="text-sm leading-relaxed">
            {i18n.language === 'ru' 
              ? `Сегодня ваш энергопрогноз — ${recommendation.currentDayEnergy}/100. Событие «${recommendation.eventTitle}» может перегрузить день.`
              : `Today your energy forecast is ${recommendation.currentDayEnergy}/100. Event "${recommendation.eventTitle}" may overload your day.`
            }
          </p>
        </div>

        {/* Предлагаемые варианты */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            📅 {i18n.language === 'ru' ? 'Предлагаемые варианты переноса:' : 'Suggested move options:'}
          </p>
          <div className="space-y-2">
            {recommendation.suggestedSlots.map((slot, index) => (
              <div 
                key={slot.date}
                className="flex items-center justify-between bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 border"
              >
                <span className="text-sm">
                  {format(parseISO(slot.date), i18n.language === 'ru' ? 'EEE, d MMMM' : 'EEE, MMMM d', { 
                    locale: i18n.language === 'ru' ? ru : undefined 
                  })}
                </span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {i18n.language === 'ru' ? 'прогноз энергии' : 'energy forecast'} {slot.energy}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleMoveEvent}
            disabled={moving}
            className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
          >
            {moving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {i18n.language === 'ru' ? 'Переношу...' : 'Moving...'}
              </>
            ) : (
              <>
                🔁 {i18n.language === 'ru' ? 'Перенести' : 'Move'}
              </>
            )}
          </Button>
          <Button
            onClick={handleSkip}
            variant="outline"
            disabled={moving}
            className="flex-1"
          >
            {i18n.language === 'ru' ? 'Пропустить' : 'Skip'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
