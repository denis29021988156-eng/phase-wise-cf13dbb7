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

  const getPhaseBackground = (phase?: string) => {
    const backgrounds: Record<string, string> = {
      menstrual: 'bg-red-500/10 dark:bg-red-500/20 border-red-500/30',
      follicular: 'bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/30',
      ovulation: 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30',
      luteal: 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/30'
    };
    return backgrounds[phase || ''] || 'bg-muted/50 border-border';
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-semibold mb-4 px-2">Прогноз на неделю</h3>
      
      {/* 7-column grid for week forecast */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
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
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105 ${getPhaseBackground(day.cycle_phase)}`}
            >
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {dayOfWeek}
              </span>
              <span className="text-sm text-muted-foreground">
                {dateShort}
              </span>
              <div className="flex flex-col items-center gap-1">
                <span className={`text-3xl font-bold ${getPhaseColor(day.cycle_phase)}`}>
                  {day.wellness_index?.toFixed(1) || '?'}
                </span>
                <span className="text-xs text-muted-foreground">/5</span>
              </div>
              <span className="text-2xl">
                {getPhaseEmoji(day.cycle_phase)}
              </span>
              
              {hasEvents && (
                <div className="flex flex-col gap-1 mt-2 w-full">
                  {day.events.slice(0, 2).map((event: any, eidx: number) => (
                    <div 
                      key={eidx}
                      className="text-[10px] px-2 py-1 rounded-md bg-background/50 text-center truncate"
                      title={event.name}
                    >
                      {event.impact < -0.3 ? '⚠️' : '✅'} {event.name}
                    </div>
                  ))}
                  {day.events.length > 2 && (
                    <div className="text-[9px] text-muted-foreground text-center">
                      +{day.events.length - 2} еще
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Hot Events list */}
      <div className="space-y-2 px-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          🔥 Ключевые события недели
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {weekForecast
            .slice(0, 7)
            .filter(day => day.events && day.events.length > 0 && day.date)
            .map((day, idx) => {
              const dayDate = new Date(day.date);
              if (isNaN(dayDate.getTime())) return null;
              
              const dayOfWeek = format(dayDate, 'EEEE', { locale: ru });
              
              return day.events?.map((event: any, eidx: number) => (
                <div
                  key={`${idx}-${eidx}`}
                  className={`p-3 rounded-lg text-sm border ${
                    event.impact < -0.3
                      ? 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-300'
                      : 'bg-green-500/10 border-green-500/30 text-green-900 dark:text-green-300'
                  }`}
                >
                  <span className="mr-2">
                    {event.impact < -0.3 ? '⚠️' : '✅'}
                  </span>
                  <span className="font-semibold">{dayOfWeek}:</span>{' '}
                  {event.name}
                  {event.impact && (
                    <span className="ml-2 font-bold">
                      ({event.impact > 0 ? '+' : ''}{event.impact.toFixed(2)})
                    </span>
                  )}
                </div>
              ));
            })}
        </div>
        
        {!weekForecast.some(day => day.events && day.events.length > 0) && (
          <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
            Ключевых событий на этой неделе нет
          </p>
        )}
      </div>
    </div>
  );
}
