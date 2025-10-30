import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EventWithImpact {
  id: string;
  title: string;
  start_time: string;
  eventType: string;
  timeOfDay: string;
  cyclePhase: string;
  energyImpact: number;
}

interface EventsImpactSectionProps {
  events: EventWithImpact[];
  cyclePhase: string;
  onAddEvent?: () => void;
}

export function EventsImpactSection({ events, cyclePhase, onAddEvent }: EventsImpactSectionProps) {
  const getImpactArrow = (impact: number) => {
    if (impact > 0.2) return '↑';
    if (impact < -0.2) return '↓';
    return '→';
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0.2) return 'text-green-600';
    if (impact < -0.2) return 'text-red-600';
    return 'text-orange-600';
  };

  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <p className="text-[10px] text-muted-foreground py-2 text-center">
          Нет событий
        </p>
      ) : (
        <>
          {events.slice(0, 3).map((event) => (
            <div 
              key={event.id}
              className="bg-card p-2 rounded-md border-l-2 border-primary text-[10px]"
            >
              <div className="flex items-center gap-1 mb-1">
                <span className="text-muted-foreground">
                  🕐 {event.start_time ? format(new Date(event.start_time), 'HH:mm') : '--:--'}
                </span>
              </div>
              <div className="font-medium truncate mb-1">{event.title}</div>
              
              <div className="flex items-center justify-between">
                <span className={`font-bold ${getImpactColor(event.energyImpact)}`}>
                  {event.energyImpact > 0 ? '+' : ''}{event.energyImpact.toFixed(2)}
                </span>
                <span className={getImpactColor(event.energyImpact)}>
                  {getImpactArrow(event.energyImpact)}
                </span>
              </div>
            </div>
          ))}
          {events.length > 3 && (
            <p className="text-[9px] text-center text-muted-foreground py-1">
              +{events.length - 3} еще
            </p>
          )}
        </>
      )}
    </div>
  );
}
