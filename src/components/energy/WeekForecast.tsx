import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DayForecast {
  date: string;
  wellness_index: number;
  cycle_phase?: string;
  events?: Array<{ name: string; impact: number }>;
}

interface WeekForecastProps {
  forecast: DayForecast[];
}

export function WeekForecast({ forecast }: WeekForecastProps) {
  const getPhaseColor = (phase?: string) => {
    const colors: Record<string, string> = {
      menstrual: 'text-red-500',
      follicular: 'text-orange-500',
      ovulation: 'text-green-500',
      luteal: 'text-purple-500'
    };
    return colors[phase || ''] || 'text-gray-500';
  };

  const getPhaseEmoji = (phase?: string) => {
    const emojis: Record<string, string> = {
      menstrual: '🔴',
      follicular: '🟡',
      ovulation: '🟢',
      luteal: '🟣'
    };
    return emojis[phase || ''] || '⚪';
  };

  const weekForecast = forecast.slice(0, 7);

  return (
    <div className="p-4 bg-yellow-50/50 dark:bg-yellow-950/20 rounded-xl mb-6">
      <h3 className="text-lg font-semibold mb-4">Энергия на неделю</h3>
      
      {/* Week Chart */}
      <div className="bg-card rounded-lg p-4 shadow-sm mb-4">
        <div className="flex justify-between gap-1">
          {weekForecast.map((day, idx) => {
            if (!day.date) return null;
            
            const dayDate = new Date(day.date);
            if (isNaN(dayDate.getTime())) return null;
            
            const dayOfWeek = format(dayDate, 'EEE', { locale: ru });
            const dateShort = format(dayDate, 'dd.MM');
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {dayOfWeek}
                </span>
                <span className={`text-lg font-bold ${getPhaseColor(day.cycle_phase)}`}>
                  {day.wellness_index?.toFixed(1) || '?'}
                </span>
                <span className="text-base">
                  {getPhaseEmoji(day.cycle_phase)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {dateShort}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Hot Events */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          🔥 Ключевые события
        </h4>
        
        {weekForecast
          .filter(day => day.events && day.events.length > 0 && day.date)
          .map((day, idx) => {
            const dayDate = new Date(day.date);
            if (isNaN(dayDate.getTime())) return null;
            
            const dayOfWeek = format(dayDate, 'EEEE', { locale: ru });
            
            return day.events?.map((event, eidx) => (
              <div
                key={`${idx}-${eidx}`}
                className={`p-2 rounded-lg text-sm ${
                  event.impact < -0.3
                    ? 'bg-red-100 dark:bg-red-950/30 text-red-900 dark:text-red-300'
                    : 'bg-green-100 dark:bg-green-950/30 text-green-900 dark:text-green-300'
                }`}
              >
                <span className="mr-1">
                  {event.impact < -0.3 ? '⚠️' : '✅'}
                </span>
                <span className="font-medium">{dayOfWeek}:</span>{' '}
                {event.name}
                {event.impact && (
                  <span className="ml-1 font-semibold">
                    ({event.impact > 0 ? '+' : ''}{event.impact.toFixed(2)})
                  </span>
                )}
              </div>
            ));
          })}
        
        {!weekForecast.some(day => day.events && day.events.length > 0) && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Ключевых событий пока нет
          </p>
        )}
      </div>
    </div>
  );
}
