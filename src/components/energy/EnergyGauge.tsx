import { MoonPhase } from '@/components/ui/moon-phase';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface EnergyGaugeProps {
  score: number;  // wellness_index from 0 to 100
  phase: string;
  date: string;
}

export function EnergyGauge({ score, phase, date }: EnergyGaugeProps) {
  const { t, i18n } = useTranslation();
  
  const phaseLabels: Record<string, string> = {
    menstrual: `🔴 ${t('energy.menstrual')}`,
    follicular: `🔵 ${t('energy.follicular')}`,
    ovulation: `🟡 ${t('energy.ovulation')}`,
    luteal: `🟣 ${t('energy.luteal')}`
  };

  const locale = i18n.language === 'ru' ? ru : enUS;
  const formattedDate = date ? format(new Date(date), 'd MMMM', { locale }) : (i18n.language === 'ru' ? 'Сегодня' : 'Today');

  return (
    <div className="flex flex-col items-center p-3 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 rounded-xl">
      <h2 className="text-sm font-semibold mb-2">{t('energy.wellnessIndexTitle')}</h2>
      
      <div className="relative w-32 h-32 my-2">
        <MoonPhase 
          value={score}
          className="w-32 h-32"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-foreground">{score}</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 mt-2">
        <span className="text-xs font-medium px-3 py-1 bg-card rounded-full">
          {phaseLabels[phase] || phase}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
