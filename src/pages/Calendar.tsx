import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AddEventDialog from '@/components/dialogs/AddEventDialog';

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  source: string;
}

interface EventWithSuggestion extends Event {
  suggestion?: string;
  justification?: string;
}

interface UserCycle {
  cycle_length: number;
  start_date: string;
  menstrual_length: number;
}

const Calendar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState<EventWithSuggestion[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [userCycle, setUserCycle] = useState<UserCycle | null>(null);

  // Generate 7 days starting from currentWeekStart
  const generateWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = generateWeekDates();

  // Load user cycle data and events
  useEffect(() => {
    if (user) {
      loadUserCycle();
      loadEvents();
    }
  }, [user, selectedDate]);

  const loadUserCycle = async () => {
    if (!user) return;
    
    try {
      const { data: cycleData } = await supabase
        .from('user_cycles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (cycleData) {
        setUserCycle(cycleData);
      }
    } catch (error) {
      console.error('Error loading user cycle:', error);
    }
  };

  const loadEvents = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_ai_suggestions(suggestion, justification)
        `)
        .eq('user_id', user.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time');

      if (eventsError) throw eventsError;
      
      const eventsWithSuggestions = (eventsData || []).map(event => ({
        ...event,
        suggestion: event.event_ai_suggestions?.[0]?.suggestion,
        justification: event.event_ai_suggestions?.[0]?.justification
      }));
      
      setEvents(eventsWithSuggestions);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogleCalendar = async () => {
    if (!user) return;
    
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: { userId: user.id }
      });

      if (error) {
        console.error('Sync error:', error);
        toast({
          title: "Ошибка синхронизации",
          description: error.message || "Не удалось загрузить события из Google Календаря",
          variant: "destructive",
        });
        return;
      }

      if (data?.success) {
        toast({
          title: 'Календарь синхронизирован',
          description: data.message || `Загружено ${data?.eventsCount || 0} событий`,
        });
        loadEvents(); // Refresh events
      } else {
        toast({
          title: "Ошибка",
          description: data?.error || "Произошла ошибка при синхронизации",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error syncing Google Calendar:', error);
      toast({
        title: 'Ошибка синхронизации',
        description: error?.message || 'Не удалось загрузить события из Google Календаря',
        variant: 'destructive',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric',
      month: 'short' 
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toISOString().split('T')[0] === selectedDate;
  };

  // Calculate cycle phase for a given date
  const getCyclePhaseForDate = (date: Date) => {
    if (!userCycle) return null;

    const startDate = new Date(userCycle.start_date);
    const diffInDays = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const cycleDay = ((diffInDays % userCycle.cycle_length) + 1);
    const adjustedCycleDay = cycleDay > 0 ? cycleDay : userCycle.cycle_length + cycleDay;

    const ovulationDay = Math.round(userCycle.cycle_length / 2);
    const ovulationLength = 2;
    const follicularStart = userCycle.menstrual_length + 1;
    const follicularEnd = ovulationDay - 1;
    const ovulationStart = ovulationDay;
    const ovulationEnd = ovulationDay + ovulationLength - 1;

    if (adjustedCycleDay >= 1 && adjustedCycleDay <= userCycle.menstrual_length) {
      return 'menstrual';
    } else if (adjustedCycleDay >= follicularStart && adjustedCycleDay <= follicularEnd) {
      return 'follicular';
    } else if (adjustedCycleDay >= ovulationStart && adjustedCycleDay <= ovulationEnd) {
      return 'ovulation';
    } else {
      return 'luteal';
    }
  };

  // Get phase color classes
  const getPhaseColor = (phase: string | null) => {
    switch (phase) {
      case 'menstrual':
        return 'border-red-400 bg-red-50';
      case 'follicular':
        return 'border-blue-400 bg-blue-50';
      case 'ovulation':
        return 'border-yellow-400 bg-yellow-50';
      case 'luteal':
        return 'border-purple-400 bg-purple-50';
      default:
        return '';
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Календарь</h1>
        <div className="flex space-x-2">
          <Button
            onClick={() => setAddEventOpen(true)}
            size="sm"
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить
          </Button>
          <Button
            onClick={handleConnectGoogleCalendar}
            disabled={googleLoading}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            style={{ boxShadow: 'var(--wellness-glow)' }}
          >
            {googleLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                <span>Синхронизация...</span>
              </div>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Подключить Google Календарь
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">
              {weekDates[0].toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, index) => {
              const dateString = date.toISOString().split('T')[0];
              const selected = isSelected(date);
              const today = isToday(date);
              const phase = getCyclePhaseForDate(date);
              const phaseColors = getPhaseColor(phase);
              
              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(dateString)}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 border-2 relative ${
                    selected 
                      ? 'bg-primary text-primary-foreground shadow-md scale-105 border-primary'
                      : today
                      ? 'bg-accent text-accent-foreground font-medium border-accent'
                      : `hover:bg-muted text-foreground border-transparent ${phaseColors}`
                  }`}
                >
                  <span className="text-xs uppercase mb-1">
                    {date.toLocaleDateString('ru-RU', { weekday: 'short' })}
                  </span>
                  <span className={`text-lg font-semibold ${selected ? 'text-primary-foreground' : ''}`}>
                    {date.getDate()}
                  </span>
                  {phase && !selected && (
                    <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full opacity-60" 
                         style={{
                           backgroundColor: phase === 'menstrual' ? '#ef4444' : 
                                          phase === 'follicular' ? '#3b82f6' :
                                          phase === 'ovulation' ? '#eab308' : '#a855f7'
                         }}>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Events for Selected Date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            События на {new Date(selectedDate).toLocaleDateString('ru-RU', { 
              day: 'numeric', 
              month: 'long' 
            })}
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-foreground">{event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(event.start_time)} - {formatTime(event.end_time)}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      event.source === 'google' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {event.source === 'google' ? 'Google' : 'Ручной'}
                    </div>
                  </div>
                  
                  {event.suggestion && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-start space-x-2">
                        <div className="p-1 rounded-full bg-primary/10 mt-0.5">
                          <svg className="h-3 w-3 text-primary" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-primary mb-1">Ева AI:</p>
                          <p className="text-sm text-muted-foreground">{event.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="flex justify-center mb-4">
                <CalendarDays className="h-12 w-12 opacity-50" />
              </div>
              <p>На этот день событий нет</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => setAddEventOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить событие
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddEventDialog 
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        selectedDate={selectedDate}
        onEventAdded={loadEvents}
      />
    </div>
  );
};

export default Calendar;