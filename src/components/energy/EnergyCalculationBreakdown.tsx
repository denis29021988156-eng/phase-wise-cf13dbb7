import { Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CalculationData {
  base: number;
  events: number;
  sleep: number;
  stress: number;
  formula: string;
}

interface EnergyCalculationBreakdownProps {
  calculation: CalculationData;
  confidence: number;
}

export function EnergyCalculationBreakdown({ calculation, confidence }: EnergyCalculationBreakdownProps) {
  const total = calculation.base + calculation.events + calculation.sleep + calculation.stress;

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5" />
          Расчет энергии
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* Base Energy */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Базовая энергия (фаза)</span>
            <span className="text-lg font-bold text-green-600">+{calculation.base.toFixed(1)}</span>
          </div>
          
          {/* Events */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <span className="text-sm font-medium">События</span>
            <span className={`text-lg font-bold ${calculation.events >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculation.events >= 0 ? '+' : ''}{calculation.events.toFixed(1)}
            </span>
          </div>
          
          {/* Sleep and Stress */}
          {(calculation.sleep !== 0 || calculation.stress !== 0) && (
            <div className="space-y-1">
              {calculation.sleep !== 0 && (
                <div className="flex items-center justify-between p-2 bg-muted/20 rounded text-xs">
                  <span className="font-medium">Качество сна</span>
                  <span className={`font-semibold ${calculation.sleep > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculation.sleep > 0 ? '+' : ''}{calculation.sleep.toFixed(1)}
                  </span>
                </div>
              )}
              {calculation.stress !== 0 && (
                <div className="flex items-center justify-between p-2 bg-muted/20 rounded text-xs">
                  <span className="font-medium">Уровень стресса</span>
                  <span className={`font-semibold ${calculation.stress > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculation.stress > 0 ? '+' : ''}{calculation.stress.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Final result */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border-2 border-primary/20">
            <span className="font-semibold">Итоговый балл</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600">
                {total.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">/5</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
