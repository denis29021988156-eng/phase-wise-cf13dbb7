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
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>(undefined);
  const [loading, setLoading] = useState(false);


  const handleSave = async () => {
    if (!user || !dateRange?.from) return;

    setLoading(true);
    try {
      const formatDateLocal = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      const startDate = dateRange.from;
      const endDate = dateRange.to || dateRange.from;
      
      // Calculate number of days (inclusive)
      const diffInMs = endDate.getTime() - startDate.getTime();
      const menstrualLength = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
      
      console.log('Saving period data:', {
        startDate: startDate.toLocaleDateString('ru-RU'),
        endDate: endDate.toLocaleDateString('ru-RU'),
        menstrualLength
      });

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
            start_date: formatDateLocal(startDate),
            menstrual_length: menstrualLength,
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_cycles')
          .insert({
            user_id: user.id,
            start_date: formatDateLocal(startDate),
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

      setDateRange(undefined);
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
          {dateRange?.from && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4" />
              <span>
                Выбрано дней: {dateRange.to 
                  ? Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
                  : 1}
              </span>
            </div>
          )}

          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range) => {
              if (range?.from) {
                const normalizedFrom = new Date(range.from);
                normalizedFrom.setHours(0, 0, 0, 0);
                
                const normalizedTo = range.to ? new Date(range.to) : undefined;
                if (normalizedTo) {
                  normalizedTo.setHours(0, 0, 0, 0);
                }
                
                setDateRange({
                  from: normalizedFrom,
                  to: normalizedTo
                });
              } else {
                setDateRange(undefined);
              }
            }}
            className="rounded-md border"
            disabled={(date) => date > new Date()}
          />

          {dateRange?.from && (
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">
                Первый день: {dateRange.from.toLocaleDateString('ru-RU')}
              </p>
              {dateRange.to && dateRange.to.getTime() !== dateRange.from.getTime() && (
                <p className="text-muted-foreground">
                  Последний день: {dateRange.to.toLocaleDateString('ru-RU')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setDateRange(undefined);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !dateRange?.from}
          >
            {loading ? 'Сохранение...' : 'Сохранить и пересчитать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PeriodTrackingDialog;