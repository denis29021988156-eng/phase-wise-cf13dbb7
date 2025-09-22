import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  source: string;
}

const Calendar = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [loading, setLoading] = useState(false);

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

  // Load events for the selected date
  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user, selectedDate]);

  const loadEvents = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time');

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Календарь</h1>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          style={{ boxShadow: 'var(--wellness-glow)' }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
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
              
              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(dateString)}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${
                    selected 
                      ? 'bg-primary text-primary-foreground shadow-md scale-105'
                      : today
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span className="text-xs text-muted-foreground uppercase">
                    {date.toLocaleDateString('ru-RU', { weekday: 'short' })}
                  </span>
                  <span className={`text-lg font-semibold ${selected ? 'text-primary-foreground' : ''}`}>
                    {date.getDate()}
                  </span>
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
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors"
                >
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
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="flex justify-center mb-4">
                <CalendarDays className="h-12 w-12 opacity-50" />
              </div>
              <p>На этот день событий нет</p>
              <Button variant="outline" size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Добавить событие
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Calendar;