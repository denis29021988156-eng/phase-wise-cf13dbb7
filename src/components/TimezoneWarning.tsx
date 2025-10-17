import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface TimezoneWarningProps {
  userTimezone: string;
}

// Map Windows timezones to IANA
const windowsToIana: Record<string, string> = {
  'Russian Standard Time': 'Europe/Moscow',
  'FLE Standard Time': 'Europe/Kiev',
  'W. Europe Standard Time': 'Europe/Berlin',
  'GMT Standard Time': 'Europe/London',
  'Romance Standard Time': 'Europe/Paris',
  'Arabian Standard Time': 'Asia/Dubai',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'China Standard Time': 'Asia/Shanghai',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Central Standard Time': 'America/Chicago',
  'Eastern Standard Time': 'America/New_York',
  'UTC': 'UTC',
};

export function TimezoneWarning({ userTimezone }: TimezoneWarningProps) {
  const [outlookTimezone, setOutlookTimezone] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOutlookTimezone();
  }, [userTimezone]);

  const checkOutlookTimezone = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-outlook-timezone', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking Outlook timezone:', error);
        setLoading(false);
        return;
      }

      if (data?.connected && data.outlookTimezone) {
        setOutlookTimezone(data.outlookTimezone);
        
        // Convert Windows timezone to IANA if needed
        const ianaTimezone = windowsToIana[data.outlookTimezone] || data.outlookTimezone;
        
        // Check if timezones match
        if (ianaTimezone !== userTimezone) {
          setMismatch(true);
        }
      }
    } catch (error) {
      console.error('Failed to check Outlook timezone:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !mismatch || dismissed) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Несовпадение часовых поясов</AlertTitle>
      <AlertDescription className="flex items-start justify-between gap-2">
        <span>
          Ваш часовой пояс в приложении ({userTimezone}) не совпадает с настройками Outlook ({outlookTimezone}). 
          Это может привести к неправильному отображению времени событий в Outlook календаре.
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
