import { MoonPhase } from '@/components/ui/moon-phase';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface EnergyGaugeProps {
  score: number;
  phase: string;
  date: string;
}

export function EnergyGauge({ score, phase, date }: EnergyGaugeProps) {
  const phaseLabels: Record<string, string> = {
    menstrual: '🔴 Менструация',
    follicular: '🔵 Фолликулярная',
    ovulation: '🟡 Овуляция',
    luteal: '🟣 Лютеиновая'
  };

  const formattedDate = date ? format(new Date(date), 'd MMMM', { locale: ru }) : 'Сегодня';

  return (
    <div className="flex flex-col items-center p-3 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 rounded-xl">
      <h2 className="text-sm font-semibold mb-2">Индекс самочувствия</h2>
      
      <div className="relative w-32 h-32 my-2">
        <MoonPhase 
          value={((score / 5) * 100)}
          className="w-32 h-32"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{score}</span>
          <span className="text-lg text-muted-foreground">/5</span>
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
