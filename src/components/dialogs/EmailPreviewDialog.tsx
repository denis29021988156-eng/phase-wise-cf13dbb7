import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  body: string;
  recipients: string[];
  eventTitle: string;
  onSend: (editedSubject: string, editedBody: string) => Promise<void>;
  sending: boolean;
}

const EmailPreviewDialog = ({
  open,
  onOpenChange,
  subject: initialSubject,
  body: initialBody,
  recipients,
  eventTitle,
  onSend,
  sending,
}: EmailPreviewDialogProps) => {
  const { t } = useTranslation();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  const handleSend = async () => {
    await onSend(subject, body);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-primary" />
            <span>{t('emailPreview.title')}</span>
          </DialogTitle>
          <DialogDescription>
            {t('emailPreview.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipients */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">{t('emailPreview.recipients')}</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {recipients.map((email, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-sm"
                >
                  {email}
                </span>
              ))}
            </div>
          </div>

          {/* Event */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">{t('emailPreview.event')}</Label>
            <p className="mt-1 text-sm text-foreground">{eventTitle}</p>
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="email-subject">{t('emailPreview.subject')}</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('emailPreview.subject')}
              className="mt-1"
            />
          </div>

          {/* Body */}
          <div>
            <Label htmlFor="email-body">{t('emailPreview.body')}</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('emailPreview.body')}
              rows={12}
              className="mt-1 font-sans"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('emailPreview.editPrompt')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            <X className="h-4 w-4 mr-2" />
            {t('emailPreview.cancel')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('emailPreview.sending')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t('emailPreview.send')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmailPreviewDialog;
