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
    follicular: '🟡 Фолликулярная',
    ovulation: '🟢 Овуляция',
    luteal: '🟣 Лютеиновая'
  };

  const formattedDate = date ? format(new Date(date), 'd MMMM yyyy', { locale: ru }) : 'Сегодня';

  return (
    <div className="flex flex-col items-center p-6 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 rounded-2xl mb-6">
      <h2 className="text-xl font-semibold mb-4">Индекс самочувствия</h2>
      
      <div className="relative w-48 h-48 my-4">
        <MoonPhase 
          value={((score / 5) * 100)}
          className="w-48 h-48"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-foreground">{score}</span>
          <span className="text-2xl text-muted-foreground">/5</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 mt-4">
        <span className="text-base font-medium px-4 py-2 bg-card rounded-full">
          {phaseLabels[phase] || phase}
        </span>
        <span className="text-sm text-muted-foreground">
          Сегодня, {formattedDate}
        </span>
      </div>
    </div>
  );
}
