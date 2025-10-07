import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Droplet, Check } from 'lucide-react';

interface PeriodTrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const PeriodTrackingDialog = ({ open, onOpenChange, onUpdate }: PeriodTrackingDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);


  const handleSave = async () => {
    if (!user || selectedDates.length === 0) return;

    setLoading(true);
    try {
      console.log('Saving period data:', {
        selectedDatesCount: selectedDates.length,
        dates: selectedDates.map(d => d.toLocaleDateString('ru-RU'))
      });
      
      // Find the first and last dates
      const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
      const startDate = sortedDates[0];
      const menstrualLength = sortedDates.length;

      // Update user_cycles
      const { data: existingCycle } = await supabase
        .from('user_cycles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCycle) {
        await supabase
          .from('user_cycles')
          .update({
            start_date: startDate.toISOString().split('T')[0],
            menstrual_length: menstrualLength,
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_cycles')
          .insert({
            user_id: user.id,
            start_date: startDate.toISOString().split('T')[0],
            menstrual_length: menstrualLength,
            cycle_length: 28, // default
          });
      }

      // Call edge function to recalculate all AI suggestions
      const { error: recalcError } = await supabase.functions.invoke('recalculate-suggestions', {
        body: { userId: user.id }
      });

      if (recalcError) {
        console.error('Error recalculating suggestions:', recalcError);
      }

      toast({
        title: 'Месячные обновлены',
        description: `Отмечено ${menstrualLength} дней. Все советы пересчитаны.`,
      });

      setSelectedDates([]);
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating period:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить данные о месячных',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-primary" />
            Отметить месячные
          </DialogTitle>
          <DialogDescription>
            Выберите все дни месячных. Это обновит расчет цикла и пересчитает все советы.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4" />
            <span>Выбрано дней: {selectedDates.length}</span>
          </div>

          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={(dates) => {
              if (dates) {
                const normalizedDates = dates.map(d => {
                  const normalized = new Date(d);
                  normalized.setHours(0, 0, 0, 0);
                  return normalized;
                }).sort((a, b) => a.getTime() - b.getTime());
                setSelectedDates(normalizedDates);
                console.log('Selected dates:', normalizedDates.length, normalizedDates.map(d => d.toLocaleDateString('ru-RU')));
              } else {
                setSelectedDates([]);
              }
            }}
            className="rounded-md border"
            disabled={(date) => date > new Date()}
          />

          {selectedDates.length > 0 && (
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">
                Первый день: {selectedDates[0]?.toLocaleDateString('ru-RU')}
              </p>
              {selectedDates.length > 1 && (
                <p className="text-muted-foreground">
                  Последний день: {selectedDates[selectedDates.length - 1]?.toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedDates([]);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || selectedDates.length === 0}
          >
            {loading ? 'Сохранение...' : 'Сохранить и пересчитать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PeriodTrackingDialog;