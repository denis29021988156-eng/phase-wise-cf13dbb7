import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

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
  const [showFormula, setShowFormula] = useState(false);

  const total = calculation.base + calculation.events + calculation.sleep + calculation.stress;

  return (
    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
      <h3 className="text-xs font-semibold mb-2">Расчет энергии</h3>
      
      <div className="bg-card rounded-md p-2 shadow-sm space-y-1.5 text-[10px]">
        {/* Base Energy */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Базовая (фаза):</span>
          <span className="font-semibold text-green-600">+{calculation.base.toFixed(2)}</span>
        </div>
        
        {/* Events */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">События:</span>
          <span className={`font-semibold ${calculation.events >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {calculation.events >= 0 ? '+' : ''}{calculation.events.toFixed(2)}
          </span>
        </div>
        
        {/* Sleep */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Сон:</span>
          <span className={`font-semibold ${calculation.sleep >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {calculation.sleep >= 0 ? '+' : ''}{calculation.sleep.toFixed(2)}
          </span>
        </div>
        
        {/* Stress */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Стресс:</span>
          <span className={`font-semibold ${calculation.stress >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {calculation.stress >= 0 ? '+' : ''}{calculation.stress.toFixed(2)}
          </span>
        </div>
        
        <div className="border-t my-1.5"></div>
        
        {/* Final Score */}
        <div className="flex justify-between items-center font-bold pt-1">
          <span className="text-foreground">📊 ИТОГО:</span>
          <span className="text-green-600 text-sm">
            {total.toFixed(1)}/5 ✅
          </span>
        </div>
      </div>
      
      {/* Confidence Badge */}
      <div className="flex items-center justify-between mt-2 p-2 bg-card rounded-md">
        <span className="text-[10px] text-muted-foreground">Точность:</span>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
          {confidence}%
        </Badge>
      </div>
      
      {/* Formula Debug */}
      <div className="mt-2">
        <button
          onClick={() => setShowFormula(!showFormula)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showFormula ? 'rotate-180' : ''}`} />
          📐 Формула
        </button>
        
        {showFormula && (
          <div className="mt-1 p-2 bg-muted rounded text-[9px]">
            <code className="break-all">{calculation.formula}</code>
          </div>
        )}
      </div>
    </div>
  );
}
