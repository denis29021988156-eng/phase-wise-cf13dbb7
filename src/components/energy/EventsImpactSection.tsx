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
    if (impact > 0.2) return '↑ Энергия растет';
    if (impact < -0.2) return '↓ Энергия падает';
    return '→ Нейтрально';
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0.2) return 'text-green-600';
    if (impact < -0.2) return 'text-red-600';
    return 'text-orange-600';
  };

  return (
    <div className="p-4 bg-muted/30 rounded-xl mb-6">
      <h3 className="text-lg font-semibold mb-4">События и их влияние</h3>
      
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Нет событий на сегодня
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div 
              key={event.id}
              className="bg-card p-3 rounded-lg border-l-4 border-primary shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      🕐 {format(new Date(event.start_time), 'HH:mm')}
                    </span>
                  </div>
                  <span className="font-medium text-sm">{event.title}</span>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground mb-2">
                Фаза: {cyclePhase} • {event.timeOfDay}
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Коэффициент:</span>
                  <span className={`font-bold ${getImpactColor(event.energyImpact)}`}>
                    {event.energyImpact > 0 ? '+' : ''}{event.energyImpact.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({event.eventType})
                  </span>
                </div>
              </div>
              
              <div className={`mt-2 text-sm font-medium ${getImpactColor(event.energyImpact)}`}>
                {getImpactArrow(event.energyImpact)}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {onAddEvent && (
        <Button 
          onClick={onAddEvent}
          variant="outline"
          className="w-full mt-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить событие
        </Button>
      )}
    </div>
  );
}
