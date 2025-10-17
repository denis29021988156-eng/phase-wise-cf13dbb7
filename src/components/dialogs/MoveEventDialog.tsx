import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock } from 'lucide-react';

interface MoveEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  } | null;
  onMove: (newStartTime: string, newEndTime: string, reason: string) => Promise<void>;
}

const MoveEventDialog = ({ open, onOpenChange, event, onMove }: MoveEventDialogProps) => {
  const [newStartDate, setNewStartDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens with new event
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && event) {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      
      setNewStartDate(start.toISOString().split('T')[0]);
      setNewStartTime(start.toTimeString().slice(0, 5));
      setNewEndTime(end.toTimeString().slice(0, 5));
      setReason('');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!event || !newStartDate || !newStartTime || !newEndTime || !reason.trim()) {
      return;
    }

    setLoading(true);
    try {
      const newStart = `${newStartDate}T${newStartTime}:00`;
      const newEnd = `${newStartDate}T${newEndTime}:00`;
      
      await onMove(newStart, newEnd, reason);
      onOpenChange(false);
    } catch (error) {
      console.error('Error in MoveEventDialog:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Перенести событие
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-md bg-muted/50">
            <p className="text-sm font-medium text-foreground mb-1">Текущее событие:</p>
            <p className="text-sm text-muted-foreground">{event.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(event.start_time).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
              {' – '}
              {new Date(event.end_time).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newDate">Новая дата</Label>
            <Input
              id="newDate"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newStartTime" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Начало
              </Label>
              <Input
                id="newStartTime"
                type="time"
                value={newStartTime}
                onChange={(e) => {
                  const startTime = e.target.value;
                  setNewStartTime(startTime);
                  
                  // Automatically set end time to 1 hour after start time
                  if (startTime) {
                    const [hours, minutes] = startTime.split(':');
                    const endHour = (parseInt(hours) + 1) % 24;
                    const autoEndTime = `${endHour.toString().padStart(2, '0')}:${minutes}`;
                    setNewEndTime(autoEndTime);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newEndTime" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Конец
              </Label>
              <Input
                id="newEndTime"
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Причина переноса</Label>
            <Textarea
              id="reason"
              placeholder="Например: Перенос по вашей рекомендации учитывая фазу цикла"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Причина будет использована в письме участникам
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !newStartDate || !newStartTime || !newEndTime || !reason.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                Создаю предложение...
              </>
            ) : (
              'Создать предложение'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveEventDialog;
