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
    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl mb-6">
      <h3 className="text-lg font-semibold mb-4">Как рассчитана ваша энергия</h3>
      
      <div className="bg-card rounded-lg p-3 shadow-sm space-y-2">
        {/* Header */}
        <div className="flex justify-between text-xs font-semibold text-muted-foreground pb-2 border-b">
          <span>Компонент</span>
          <span>Значение</span>
        </div>
        
        {/* Base Energy */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Базовая энергия (фаза):</span>
          <span className="font-semibold text-green-600">+{calculation.base.toFixed(2)}</span>
        </div>
        
        <div className="border-t my-2"></div>
        
        {/* Events Section */}
        <div className="text-xs font-semibold text-muted-foreground">События:</div>
        <div className="flex justify-between items-center text-sm pl-4">
          <span className="text-muted-foreground">События (итого):</span>
          <span className={`font-semibold ${calculation.events >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {calculation.events >= 0 ? '+' : ''}{calculation.events.toFixed(2)}
          </span>
        </div>
        
        <div className="border-t my-2"></div>
        
        {/* Modifiers Section */}
        <div className="text-xs font-semibold text-muted-foreground">Модификаторы:</div>
        <div className="flex justify-between items-center text-sm pl-4">
          <span className="text-muted-foreground">Качество сна:</span>
          <span className={`font-semibold ${calculation.sleep >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {calculation.sleep >= 0 ? '+' : ''}{calculation.sleep.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm pl-4">
          <span className="text-muted-foreground">Стресс:</span>
          <span className={`font-semibold ${calculation.stress >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {calculation.stress >= 0 ? '+' : ''}{calculation.stress.toFixed(2)}
          </span>
        </div>
        
        <div className="border-t-2 my-3"></div>
        
        {/* Final Score */}
        <div className="flex justify-between items-center text-base font-bold pt-2">
          <span className="text-foreground">📊 ИТОГО:</span>
          <span className="text-green-600 text-lg">
            {total.toFixed(1)}/5 ✅
          </span>
        </div>
      </div>
      
      {/* Confidence Badge */}
      <div className="flex items-center justify-between mt-4 p-3 bg-card rounded-lg">
        <span className="text-sm text-muted-foreground">Точность прогноза:</span>
        <Badge variant="secondary" className="font-semibold">
          {confidence}%
        </Badge>
      </div>
      
      {/* Formula Debug */}
      <div className="mt-4">
        <button
          onClick={() => setShowFormula(!showFormula)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showFormula ? 'rotate-180' : ''}`} />
          📐 Формула расчета
        </button>
        
        {showFormula && (
          <div className="mt-2 p-3 bg-muted rounded-lg">
            <code className="text-xs break-all">{calculation.formula}</code>
          </div>
        )}
      </div>
    </div>
  );
}
