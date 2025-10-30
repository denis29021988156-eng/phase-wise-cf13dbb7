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
      follicular: 'text-blue-500',
      ovulation: 'text-yellow-500',
      luteal: 'text-purple-500'
    };
    return colors[phase || ''] || 'text-gray-500';
  };

  const getPhaseEmoji = (phase?: string) => {
    const emojis: Record<string, string> = {
      menstrual: '🔴',
      follicular: '🔵',
      ovulation: '🟡',
      luteal: '🟣'
    };
    return emojis[phase || ''] || '⚪';
  };

  const weekForecast = forecast.slice(0, 7);

  const getPhaseBackground = (phase?: string) => {
    const backgrounds: Record<string, string> = {
      menstrual: 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-800',
      follicular: 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-800',
      ovulation: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-400 dark:border-yellow-800',
      luteal: 'bg-purple-50 dark:bg-purple-950/30 border-purple-400 dark:border-purple-800'
    };
    return backgrounds[phase || ''] || 'bg-muted/50 border-border';
  };

  return (
    <div className="w-full">
      <h3 className="text-base font-semibold mb-2">Прогноз на неделю</h3>
      
      {/* 7-column grid for week forecast - Compact */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {weekForecast.slice(0, 7).map((day, idx) => {
          if (!day.date) return null;
          
          const dayDate = new Date(day.date);
          if (isNaN(dayDate.getTime())) return null;
          
          const dayOfWeek = format(dayDate, 'EEE', { locale: ru });
          const dateShort = format(dayDate, 'dd.MM');
          const hasEvents = day.events && day.events.length > 0;
          
          return (
            <div 
              key={idx} 
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:scale-105 ${getPhaseBackground(day.cycle_phase)}`}
            >
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                {dayOfWeek}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {dateShort}
              </span>
              <div className="flex flex-col items-center">
                <span className={`text-xl font-bold ${getPhaseColor(day.cycle_phase)}`}>
                  {day.wellness_index?.toFixed(1) || '?'}
                </span>
              </div>
              <span className="text-lg">
                {getPhaseEmoji(day.cycle_phase)}
              </span>
              
              {hasEvents && (
                <div className="text-[8px] text-center text-muted-foreground mt-0.5">
                  {day.events.length} событий
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Hot Events list - Compact */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          🔥 Ключевые события недели
        </h4>
        
        <div className="grid grid-cols-2 gap-1.5">
          {weekForecast
            .slice(0, 7)
            .filter(day => day.events && day.events.length > 0 && day.date)
            .flatMap((day, idx) => {
              const dayDate = new Date(day.date);
              if (isNaN(dayDate.getTime())) return [];
              
              const dayOfWeek = format(dayDate, 'EEE', { locale: ru });
              
              return day.events?.slice(0, 2).map((event: any, eidx: number) => (
                <div
                  key={`${idx}-${eidx}`}
                  className={`p-1.5 rounded text-[10px] border ${
                    event.impact < -0.3
                      ? 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-300'
                      : 'bg-green-500/10 border-green-500/30 text-green-900 dark:text-green-300'
                  }`}
                >
                  <span className="mr-1">
                    {event.impact < -0.3 ? '⚠️' : '✅'}
                  </span>
                  <span className="font-semibold">{dayOfWeek}:</span>{' '}
                  <span className="truncate inline-block max-w-[80%]">{event.name}</span>
                </div>
              )) || [];
            })}
        </div>
        
        {!weekForecast.some(day => day.events && day.events.length > 0) && (
          <p className="text-[10px] text-muted-foreground text-center py-2 bg-muted/30 rounded">
            Ключевых событий на этой неделе нет
          </p>
        )}
      </div>
    </div>
  );
}
