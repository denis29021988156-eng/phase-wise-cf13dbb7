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
  
  const getWellnessColor = (wellness: number) => {
    if (wellness <= 30) return '#EF4444'; // red
    if (wellness <= 50) return '#F59E0B'; // orange
    if (wellness <= 70) return '#EAB308'; // yellow
    if (wellness <= 85) return '#84CC16'; // lime
    return '#22C55E'; // green
  };

  const weekForecast = forecast.slice(0, 7);

  const getPhaseBackground = (phase?: string) => {
    const backgrounds: Record<string, string> = {
      menstrual: 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800',
      follicular: 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800',
      ovulation: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-800',
      luteal: 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
    };
    return backgrounds[phase || ''] || 'bg-muted/50 border-border';
  };

  return (
    <div className="w-full">
      <h3 className="text-base font-semibold mb-2">Прогноз на неделю</h3>
      
      {/* 7-column grid for week forecast - Compact */}
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {weekForecast.slice(0, 7).map((day, idx) => {
          if (!day.date) return null;
          
          const dayDate = new Date(day.date);
          if (isNaN(dayDate.getTime())) return null;
          
          const dayOfWeek = format(dayDate, 'EEE', { locale: ru });
          const dateShort = format(dayDate, 'dd.MM');
          const hasEvents = day.events && day.events.length > 0;
          const wellness = Math.round(day.wellness_index || 0);
          const wellnessColor = getWellnessColor(wellness);
          const percentage = (wellness / 100) * 100;
          const circumference = 2 * Math.PI * 18; // radius 18
          const strokeDashoffset = circumference - (percentage / 100) * circumference;
          
          return (
            <div 
              key={idx} 
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl border-2 transition-all hover:scale-105 ${getPhaseBackground(day.cycle_phase)}`}
            >
              <span className="text-[9px] font-bold uppercase text-muted-foreground">
                {dayOfWeek}
              </span>
              <span className="text-[8px] text-muted-foreground">
                {dateShort}
              </span>
              
              {/* Circular diagram */}
              <div className="relative w-12 h-12 my-1">
                <svg viewBox="0 0 44 44" className="w-full h-full transform -rotate-90">
                  {/* Background circle */}
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="4"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke={wellnessColor}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: wellnessColor }}>
                    {wellness}
                  </span>
                </div>
              </div>
              
              <span className="text-base mt-0.5">
                {getPhaseEmoji(day.cycle_phase)}
              </span>
              
              {hasEvents && (
                <div className="text-[7px] text-center text-muted-foreground mt-0.5 px-1 py-0.5 bg-background/50 rounded">
                  {day.events.length} соб.
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
          {(() => {
            // Collect all events with their dates
            const allEventsWithDates = weekForecast
              .slice(0, 7)
              .filter(day => day.events && day.events.length > 0 && day.date)
              .flatMap(day => {
                const dayDate = new Date(day.date);
                if (isNaN(dayDate.getTime())) return [];
                const dayOfWeek = format(dayDate, 'EEE', { locale: ru });
                
                return (day.events || []).map(event => ({
                  ...event,
                  dayOfWeek,
                  date: day.date
                }));
              });

            if (allEventsWithDates.length === 0) {
              return (
                <p className="text-[10px] text-muted-foreground text-center py-2 bg-muted/30 rounded-xl border border-border/50 col-span-2">
                  Ключевых событий на этой неделе нет
                </p>
              );
            }

            // Sort by impact
            const sortedEvents = [...allEventsWithDates].sort((a, b) => a.impact - b.impact);
            
            // Get 2 most energy-draining (lowest/most negative impact)
            const mostDraining = sortedEvents.slice(0, 2);
            
            // Get 2 most beneficial (highest/most positive impact)
            const mostBeneficial = sortedEvents.slice(-2).reverse();
            
            // Combine
            const keyEvents = [...mostDraining, ...mostBeneficial];

            return keyEvents.map((event, idx) => (
              <div
                key={`${event.date}-${event.name}-${idx}`}
                className={`p-2 rounded-xl text-[10px] border-2 shadow-sm ${
                  event.impact < 0
                    ? 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-300'
                    : 'bg-green-500/10 border-green-500/30 text-green-900 dark:text-green-300'
                }`}
              >
                <span className="mr-1">
                  {event.impact < 0 ? '⚠️' : '✅'}
                </span>
                <span className="font-semibold">{event.dayOfWeek}:</span>{' '}
                <span className="truncate inline-block max-w-[60%]">{event.name}</span>
                <span className={`ml-1 font-bold ${event.impact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {event.impact > 0 ? '+' : ''}{event.impact}
                </span>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
