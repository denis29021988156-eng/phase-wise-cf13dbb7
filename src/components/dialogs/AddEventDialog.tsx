import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onEventAdded: () => void;
}

const AddEventDialog = ({ open, onOpenChange, selectedDate, onEventAdded }: AddEventDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const [syncToOutlook, setSyncToOutlook] = useState(false);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [hasMicrosoftToken, setHasMicrosoftToken] = useState(false);
  const [userTimezone, setUserTimezone] = useState('Europe/Moscow');
  const [formData, setFormData] = useState({
    title: '',
    date: selectedDate,
    startTime: '09:00',
    endTime: '10:00',
    description: '',
  });

  // Check if user has Google and Microsoft tokens when dialog opens
  useEffect(() => {
    const checkTokens = async () => {
      if (open && user) {
        // Get user timezone from profile
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('timezone')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (profileData?.timezone) {
          setUserTimezone(profileData.timezone);
        }

        const { data: googleData } = await supabase
          .from('user_tokens')
          .select('access_token')
          .eq('user_id', user.id)
          .eq('provider', 'google')
          .maybeSingle();
        
        const { data: microsoftData } = await supabase
          .from('user_tokens')
          .select('access_token')
          .eq('user_id', user.id)
          .in('provider', ['microsoft', 'azure'])
          .maybeSingle();
        
        setHasGoogleToken(!!googleData?.access_token);
        setHasMicrosoftToken(!!microsoftData?.access_token);
        if (microsoftData?.access_token) setSyncToOutlook(true);
      }
    };

    checkTokens();
  }, [open, user]);

  // Update form date when selectedDate changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, date: selectedDate }));
  }, [selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          title: formData.title,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          source: 'manual'
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Get user cycle data for AI suggestions  
      const { data: cycleData } = await supabase
        .from('user_cycles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Try to sync Apple Health data before generating AI suggestion
      let healthDataSynced = false;
      try {
        console.log('Attempting to sync Apple Health data...');
        const { syncAppleHealthData } = await import('@/utils/syncAppleHealth');
        healthDataSynced = await syncAppleHealthData(user.id);
        if (healthDataSynced) {
          console.log('Apple Health data synced successfully');
        }
      } catch (healthError) {
        console.log('Could not sync Apple Health data:', healthError);
      }

      // Generate AI suggestion if cycle data exists (calculate cycle day for this specific event date)
      if (cycleData && eventData) {
        const eventDate = new Date(formData.date);
        const startDate = new Date(cycleData.start_date);
        const diffInDays = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const eventCycleDay = ((diffInDays % cycleData.cycle_length) + 1);
        const adjustedCycleDay = eventCycleDay > 0 ? eventCycleDay : cycleData.cycle_length + eventCycleDay;

        try {
          const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke('generate-ai-suggestion', {
            body: {
              event: {
                title: formData.title,
                description: formData.description,
                start_time: startDateTime.toISOString(),
                start_time_local: formData.startTime
              },
              cycleData: {
                cycleDay: adjustedCycleDay,
                cycleLength: cycleData.cycle_length,
                startDate: cycleData.start_date
              },
              timezone: userTimezone,
              healthDataSynced: healthDataSynced
            }
          });

          if (!suggestionError && suggestionData?.suggestion) {
            await supabase
              .from('event_ai_suggestions')
              .insert({
                event_id: eventData.id,
                suggestion: suggestionData.suggestion,
                justification: suggestionData.justification || `Gaia для ${adjustedCycleDay} дня цикла (продолжительность ${cycleData.cycle_length} дней)`,
                decision: 'generated'
              });

            console.log('AI suggestion created for manual event:', formData.title);
          } else if (suggestionError) {
            console.error('AI suggestion error:', suggestionError);
          }
        } catch (aiError) {
          console.error('Error generating AI suggestion:', aiError);
        }
      }

      // Track successful syncs
      let googleSynced = false;
      let outlookSynced = false;

      // Add to Google Calendar if sync is enabled
      if (syncToGoogle && hasGoogleToken) {
        try {
          console.log('Adding event to Google Calendar...');
          
          const { data: googleResult, error: googleError } = await supabase.functions.invoke('add-to-google-calendar', {
            body: {
              userId: user.id,
              eventData: {
                title: formData.title,
                description: formData.description,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString()
              }
            }
          });

          if (googleError || !googleResult?.success) {
            console.error('Google Calendar sync error:', googleError || googleResult?.error);
            
            // Check if it's a token refresh error
            const errorMessage = googleResult?.error || (googleError as any)?.message || '';
            if (errorMessage.includes('refresh') || errorMessage.includes('token') || errorMessage.includes('401')) {
              toast({
                title: 'Требуется переподключение Google',
                description: 'Google токен устарел. Откройте меню и переподключите Google календарь.',
                variant: 'destructive',
              });
            }
          } else if (googleResult?.success) {
            googleSynced = true;
            // Update the event with Google Calendar ID
            if (googleResult.googleEventId) {
              await supabase
                .from('events')
                .update({ 
                  google_event_id: googleResult.googleEventId,
                  source: 'google'
                })
                .eq('id', eventData.id);
            }
          }
        } catch (googleError) {
          console.error('Error syncing with Google Calendar:', googleError);
        }
      }

      // Add to Outlook Calendar if sync is enabled
      if (syncToOutlook && hasMicrosoftToken) {
        try {
          console.log('Adding event to Outlook Calendar...');
          
          const startLocal = `${formData.date}T${formData.startTime}:00`;
          const endLocal = `${formData.date}T${formData.endTime}:00`;
          
          const { data: outlookResult, error: outlookError } = await supabase.functions.invoke('add-to-outlook-calendar', {
            body: {
              userId: user.id,
              eventData: {
                title: formData.title,
                description: formData.description,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                startTimeLocal: startLocal,
                endTimeLocal: endLocal,
                timeZone: userTimezone
              }
            }
          });

          if (outlookError || !outlookResult?.success) {
            console.error('Outlook Calendar sync error:', outlookError || outlookResult?.error);
            
            // Check if it's a token refresh error
            const errorMessage = outlookResult?.error || (outlookError as any)?.message || '';
            if (errorMessage.includes('refresh') || errorMessage.includes('token') || errorMessage.includes('401')) {
              toast({
                title: 'Требуется переподключение Outlook',
                description: 'Microsoft токен устарел. Откройте меню и переподключите Outlook календарь.',
                variant: 'destructive',
              });
            }
          } else if (outlookResult?.success) {
            outlookSynced = true;
            // Update the event with Microsoft event ID
            if (outlookResult.microsoftEventId) {
              await supabase
                .from('events')
                .update({ 
                  microsoft_event_id: outlookResult.microsoftEventId,
                  source: 'outlook'
                })
                .eq('id', eventData.id);
            }
          }
        } catch (outlookError) {
          console.error('Error syncing with Outlook Calendar:', outlookError);
        }
      }

      // Show appropriate toast message
      if (googleSynced && outlookSynced) {
        toast({
          title: 'Событие добавлено',
          description: 'Событие успешно добавлено и синхронизировано с Google Calendar и Outlook',
        });
      } else if (googleSynced) {
        toast({
          title: 'Событие добавлено',
          description: 'Событие успешно добавлено и синхронизировано с Google Calendar',
        });
      } else if (outlookSynced) {
        toast({
          title: 'Событие добавлено',
          description: 'Событие успешно добавлено и синхронизировано с Outlook',
        });
      } else if ((syncToGoogle && hasGoogleToken) || (syncToOutlook && hasMicrosoftToken)) {
        toast({
          title: 'Событие добавлено',
          description: 'Событие создано, но возникла ошибка синхронизации',
          variant: "default",
        });
      } else {
        toast({
          title: 'Событие добавлено',
          description: 'Событие успешно добавлено в календарь',
        });
      }

      setFormData({
        title: '',
        date: selectedDate,
        startTime: '09:00',
        endTime: '10:00',
        description: '',
      });
      
      onEventAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding event:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить событие',
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
            <Plus className="h-5 w-5 text-primary" />
            <span>Добавить событие</span>
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
                  // Automatically set end time to 1 hour after start time
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

          <div>
            <Label htmlFor="description">Описание (необязательно)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Дополнительная информация о событии..."
              rows={3}
            />
          </div>

          {hasGoogleToken && (
            <div className="flex items-center space-x-2">
              <Switch
                id="syncToGoogle"
                checked={syncToGoogle}
                onCheckedChange={setSyncToGoogle}
              />
              <Label htmlFor="syncToGoogle" className="text-sm">
                Синхронизировать с Google Calendar
              </Label>
            </div>
          )}

          {hasMicrosoftToken && (
            <div className="flex items-center space-x-2">
              <Switch
                id="syncToOutlook"
                checked={syncToOutlook}
                onCheckedChange={setSyncToOutlook}
              />
              <Label htmlFor="syncToOutlook" className="text-sm">
                Синхронизировать с Outlook
              </Label>
            </div>
          )}

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
                  <span>Добавление...</span>
                </div>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEventDialog;