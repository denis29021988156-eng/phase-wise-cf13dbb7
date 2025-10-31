import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    source: string;
  } | null;
  onEventUpdated: () => void;
}

const EditEventDialog = ({ open, onOpenChange, event, onEventUpdated }: EditEventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    description: '',
  });

  useEffect(() => {
    if (event) {
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);
      
      setFormData({
        title: event.title,
        date: startDate.toISOString().split('T')[0],
        startTime: startDate.toTimeString().slice(0, 5),
        endTime: endDate.toTimeString().slice(0, 5),
        description: '',
      });
    }
  }, [event]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !event) return;

    setLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

      // Check if event has Google Calendar sync
      const hasGoogleEventId = !!event.source && event.source === 'google';

      if (hasGoogleEventId) {
        // Update via edge function to sync with Google Calendar
        const { data, error } = await supabase.functions.invoke('update-google-event', {
          body: {
            userId: user.id,
            eventId: event.id,
            eventData: {
              title: formData.title,
              description: formData.description,
              startTime: startDateTime.toISOString(),
              endTime: endDateTime.toISOString(),
            }
          }
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to update event');
      } else {
        // Update local event only
        const { error: updateError } = await supabase
          .from('events')
          .update({
            title: formData.title,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
          })
          .eq('id', event.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      }

      // Пересчитать AI рекомендацию если изменилось время или дата
      const oldStartTime = new Date(event.start_time);
      const timeOrDateChanged = 
        oldStartTime.getTime() !== startDateTime.getTime() ||
        oldStartTime.toDateString() !== startDateTime.toDateString();

      if (timeOrDateChanged) {
        try {
          // Получить данные цикла пользователя
          const { data: cycleData } = await supabase
            .from('user_cycles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (cycleData) {
            // Вычислить день цикла для новой даты
            const newEventDate = startDateTime;
            const startDate = new Date(cycleData.start_date);
            const diffInDays = Math.floor((newEventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const cycleDay = ((diffInDays % cycleData.cycle_length) + 1);
            const adjustedCycleDay = cycleDay > 0 ? cycleDay : cycleData.cycle_length + cycleDay;

            // Получить timezone и language из профиля
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('timezone, language')
              .eq('user_id', user.id)
              .maybeSingle();

            const userTimezone = userProfile?.timezone || 'Europe/Moscow';
            const language = userProfile?.language || 'ru';

            // Вызвать функцию генерации новой рекомендации
            const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke('generate-ai-suggestion', {
              body: {
                event: {
                  id: event.id,
                  title: formData.title,
                  start_time: startDateTime.toISOString(),
                  end_time: endDateTime.toISOString(),
                  start_time_local: startDateTime.toLocaleTimeString(language === 'ru' ? 'ru-RU' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: userTimezone
                  })
                },
                cycleData: {
                  cycleDay: adjustedCycleDay,
                  cycleLength: cycleData.cycle_length,
                  menstrualLength: cycleData.menstrual_length || 5,
                  language: language,
                  start_date: cycleData.start_date
                },
                timezone: userTimezone,
                healthDataSynced: false
              }
            });

            if (!suggestionError && suggestionData?.suggestion) {
              // Обновить рекомендацию
              await supabase
                .from('event_ai_suggestions')
                .upsert({
                  event_id: event.id,
                  suggestion: suggestionData.suggestion,
                  justification: suggestionData.justification || `AI для ${adjustedCycleDay} дня цикла после ручного редактирования`,
                  decision: 'regenerated'
                }, {
                  onConflict: 'event_id'
                });

              console.log('AI recommendation updated after manual edit');
            }
          }
        } catch (aiError) {
          console.error('Error regenerating AI recommendation:', aiError);
          // Не блокируем редактирование события из-за ошибки AI
        }
      }

      // Записать действие пользователя в историю
      await supabase
        .from('event_actions')
        .insert({
          event_id: event.id,
          user_id: user.id,
          action_type: 'manual_moved',
          old_start_time: event.start_time,
          new_start_time: startDateTime.toISOString(),
          old_end_time: event.end_time,
          new_end_time: endDateTime.toISOString(),
          reason: t('editEvent.manualEdit'),
          metadata: {
            title_changed: event.title !== formData.title,
            old_title: event.title,
            new_title: formData.title
          }
        });

      toast({
        title: t('editEvent.updated'),
        description: t('editEvent.updatedDesc'),
      });

      onEventUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: t('editEvent.updateError'),
        description: t('editEvent.updateErrorDesc'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Save className="h-5 w-5 text-primary" />
            <span>{t('editEvent.title')}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Название события</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Встреча с врачом, тренировка..."
              required
            />
          </div>

          <div>
            <Label htmlFor="date">Дата</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Время начала</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => {
                  const newStartTime = e.target.value;
                  const [hours, minutes] = newStartTime.split(':');
                  const endHour = (parseInt(hours) + 1) % 24;
                  const newEndTime = `${endHour.toString().padStart(2, '0')}:${minutes}`;
                  setFormData({ ...formData, startTime: newStartTime, endTime: newEndTime });
                }}
                required
              />
            </div>
            <div>
              <Label htmlFor="endTime">Время окончания</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  <span>Сохранение...</span>
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditEventDialog;
