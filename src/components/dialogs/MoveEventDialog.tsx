import { useState } from "react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

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
  const { t, i18n } = useTranslation();
  const [newStartDate, setNewStartDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const locale = i18n.language === 'ru' ? ru : enUS;

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
            {t('moveEvent.title')}
          </DialogTitle>
          <DialogDescription>
            {i18n.language === 'ru' 
              ? 'Создайте предложение о переносе события для участников'
              : 'Create a proposal to move the event for participants'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-md bg-muted/50">
            <p className="text-sm font-medium text-foreground mb-1">
              {t('moveEvent.currentDetails')}:
            </p>
            <p className="text-sm text-muted-foreground">{event.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(event.start_time).toLocaleString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
              {' – '}
              {new Date(event.end_time).toLocaleTimeString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newDate">{t('moveEvent.newDate')}</Label>
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
                {t('moveEvent.newStartTime')}
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
                {t('moveEvent.newEndTime')}
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
            <Label htmlFor="reason">{t('moveEvent.reason')}</Label>
            <Textarea
              id="reason"
              placeholder={t('moveEvent.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {i18n.language === 'ru' 
                ? 'Причина будет использована в письме участникам'
                : 'The reason will be used in the email to participants'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('moveEvent.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !newStartDate || !newStartTime || !newEndTime || !reason.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent mr-2" />
                {t('moveEvent.creating')}
              </>
            ) : (
              t('moveEvent.createProposal')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveEventDialog;
