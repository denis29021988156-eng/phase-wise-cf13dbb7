import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  const [formData, setFormData] = useState({
    title: '',
    date: selectedDate,
    startTime: '09:00',
    endTime: '10:00',
    description: '',
  });

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

      // Generate AI suggestion if cycle data exists (calculate cycle day for this specific event date)
      if (cycleData && eventData) {
        const eventDate = new Date(formData.date);
        const startDate = new Date(cycleData.start_date);
        const diffInDays = Math.floor((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const eventCycleDay = ((diffInDays % cycleData.cycle_length) + 1);
        const adjustedCycleDay = eventCycleDay > 0 ? eventCycleDay : cycleData.cycle_length + eventCycleDay;

        try {
          const { data: suggestionData, error: suggestionError } = await supabase
            .rpc('generate_ai_suggestion_content', {
              event_title: formData.title,
              cycle_day: adjustedCycleDay,
              cycle_length: cycleData.cycle_length,
              event_description: formData.description || null
            });

          if (!suggestionError && suggestionData) {
            await supabase
              .from('event_ai_suggestions')
              .insert({
                event_id: eventData.id,
                suggestion: suggestionData,
                justification: `ИИ-совет для ${adjustedCycleDay} дня цикла (продолжительность ${cycleData.cycle_length} дней)`,
                decision: 'generated'
              });

            console.log('AI suggestion created for manual event:', formData.title);
          }
        } catch (aiError) {
          console.error('Error generating AI suggestion:', aiError);
        }
      }

      toast({
        title: 'Событие добавлено',
        description: 'Событие успешно добавлено в календарь',
      });

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
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
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