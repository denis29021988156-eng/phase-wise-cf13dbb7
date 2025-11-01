import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  
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
    <div className="space-y-3">
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">
          {t('energy.noEvents')}
        </p>
      ) : (
        <>
          {events.slice(0, 3).map((event) => (
            <div 
              key={event.id}
              className="bg-card p-3 rounded-lg border-l-4 border-primary shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">
                  🕐 {event.start_time ? format(new Date(event.start_time), 'HH:mm') : '--:--'}
                </span>
              </div>
              <div className="text-sm font-semibold truncate mb-2 text-foreground">{event.title}</div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${getImpactColor(event.energyImpact)}`}>
                    {event.energyImpact > 0 ? '+' : ''}{event.energyImpact.toFixed(2)}
                  </span>
                  <span className={`text-lg ${getImpactColor(event.energyImpact)}`}>
                    {getImpactArrow(event.energyImpact)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/calendar?date=${event.start_time.split('T')[0]}`)}
                  className="h-7 text-xs px-2"
                >
                  <Calendar className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          {events.length > 3 && (
            <p className="text-xs text-center text-muted-foreground py-1 font-medium">
              +{events.length - 3} еще
            </p>
          )}
        </>
      )}
    </div>
  );
}
