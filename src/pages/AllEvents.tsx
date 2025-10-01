import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, Lightbulb, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import EditEventDialog from '@/components/dialogs/EditEventDialog';

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  source: string;
  suggestion?: string;
  justification?: string;
}

const AllEvents = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const loadAllEvents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_ai_suggestions(suggestion, justification)
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      if (eventsError) throw eventsError;

      const eventsWithSuggestions = (eventsData || []).map(event => ({
        ...event,
        suggestion: event.event_ai_suggestions?.[0]?.suggestion,
        justification: event.event_ai_suggestions?.[0]?.justification
      }));

      setEvents(eventsWithSuggestions);
    } catch (error) {
      console.error('Error loading events:', error);
      toast({
        title: 'Ошибка загрузки событий',
        description: 'Попробуйте обновить страницу',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllEvents();
  }, [user]);

  // Set up real-time subscription for updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('all-events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadAllEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleDeleteEvent = async (event: Event) => {
    if (!user) return;
    
    if (!confirm(`Удалить событие "${event.title}"?`)) return;
    
    try {
      const hasGoogleEventId = !!event.source && event.source === 'google';
      
      if (hasGoogleEventId) {
        const { data, error } = await supabase.functions.invoke('delete-google-event', {
          body: {
            userId: user.id,
            eventId: event.id,
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to delete event');
      } else {
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .eq('id', event.id)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;
      }

      toast({
        title: 'Событие удалено',
        description: 'Событие успешно удалено из календаря',
      });

      loadAllEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить событие',
        variant: 'destructive',
      });
    }
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setEditEventOpen(true);
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'google':
        return 'hsl(var(--chart-1))';
      case 'manual':
        return 'hsl(var(--chart-2))';
      default:
        return 'hsl(var(--primary))';
    }
  };

  const groupEventsByDate = (events: Event[]) => {
    const grouped: { [key: string]: Event[] } = {};
    
    events.forEach(event => {
      const date = format(new Date(event.start_time), 'yyyy-MM-dd');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });
    
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const groupedEvents = groupEventsByDate(events);

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Все события</h1>
        <p className="text-muted-foreground mt-2">
          {events.length} {events.length === 1 ? 'событие' : events.length < 5 ? 'события' : 'событий'}
        </p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">Нет событий</p>
            <p className="text-sm text-muted-foreground mt-2">
              Добавьте события в календаре
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedEvents)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
            .map(dateKey => (
              <div key={dateKey}>
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase">
                    {format(new Date(dateKey), 'd MMMM, EEEE', { locale: ru })}
                  </h2>
                </div>
                
                <div className="space-y-3">
                  {groupedEvents[dateKey].map(event => (
                    <Card 
                      key={event.id}
                      style={{
                        borderLeft: `4px solid ${getSourceColor(event.source)}`,
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{event.title}</h3>
                            <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(event.start_time), 'HH:mm')}–
                              {format(new Date(event.end_time), 'HH:mm')}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEvent(event)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEvent(event)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {event.suggestion && (
                          <div className="mt-3 p-3 rounded-md bg-muted/50">
                            <div className="flex items-start gap-2">
                              <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                  {event.suggestion}
                                </p>
                                {event.justification && (
                                  <p className="text-xs text-muted-foreground">
                                    {event.justification}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
          ))}
        </div>
      )}

      <EditEventDialog
        open={editEventOpen}
        onOpenChange={setEditEventOpen}
        event={selectedEvent}
        onEventUpdated={loadAllEvents}
      />
    </div>
  );
};

export default AllEvents;
