import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Battery, TrendingDown, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface EnergyBalanceCardProps {
  baseEnergy: number;
  eventsImpact: number;
  sleepModifier: number;
  stressModifier: number;
  wellnessModifier?: number;
  finalEnergy: number;
  events: Array<{ title: string; energyImpact: number; start_time: string }>;
  cyclePhase: string;
}

export function EnergyBalanceCard({
  baseEnergy,
  eventsImpact,
  sleepModifier,
  stressModifier,
  wellnessModifier = 0,
  finalEnergy,
  events,
  cyclePhase
}: EnergyBalanceCardProps) {
  const [eventsOpen, setEventsOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const { t } = useTranslation();
  
  const phaseLabels: Record<string, string> = {
    menstrual: t('energy.menstrual'),
    follicular: t('energy.follicular'),
    ovulation: t('energy.ovulation'),
    luteal: t('energy.luteal')
  };
  
  const getEnergyColor = (value: number) => {
    if (value >= 70) return 'text-green-600';
    if (value >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBarColor = (value: number) => {
    if (value >= 70) return 'bg-green-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-600';
    if (impact < 0) return 'text-red-600';
    return 'text-orange-600';
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Battery className="w-5 h-5" />
          {t('energy.energyBalance')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main calculation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">{t('energy.baseEnergy')} ({phaseLabels[cyclePhase] || cyclePhase})</span>
            <span className="text-lg font-bold">{baseEnergy}</span>
          </div>

          {events.length > 0 && (
            <Collapsible open={eventsOpen} onOpenChange={setEventsOpen}>
              <div className="space-y-2">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                    <span className="text-sm font-medium">{t('energy.eventsOfDay')}:</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${eventsImpact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {eventsImpact > 0 ? '+' : ''}{eventsImpact}
                      </span>
                      {eventsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    {events.map((event, idx) => (
                      <div 
                        key={idx}
                        className="bg-card p-3 rounded-lg border-l-4 border-primary shadow-sm ml-2"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            🕐 {event.start_time ? format(new Date(event.start_time), 'HH:mm') : '--:--'}
                          </span>
                        </div>
                        <div className="text-sm font-semibold truncate mb-2 text-foreground">{event.title}</div>
                        
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-bold ${getImpactColor(event.energyImpact)}`}>
                            {event.energyImpact > 0 ? '+' : ''}{event.energyImpact}
                          </span>
                          <span className={`text-lg ${getImpactColor(event.energyImpact)}`}>
                            {event.energyImpact > 0 ? '↑' : event.energyImpact < 0 ? '↓' : '→'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {(sleepModifier !== 0 || stressModifier !== 0 || wellnessModifier !== 0) && (
            <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
              <div className="space-y-2">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                    <span className="text-sm font-medium">{t('energy.keyMetrics')}:</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${(sleepModifier + stressModifier + wellnessModifier) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(sleepModifier + stressModifier + wellnessModifier) > 0 ? '+' : ''}{sleepModifier + stressModifier + wellnessModifier}
                      </span>
                      {metricsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    {sleepModifier !== 0 && (
                      <div className="flex items-center justify-between p-3 bg-card rounded-lg border-l-4 border-primary shadow-sm ml-2">
                        <span className="text-sm font-medium">{t('energy.sleepQuality')}</span>
                        <span className={`text-lg font-bold ${sleepModifier > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {sleepModifier > 0 ? '+' : ''}{sleepModifier}
                        </span>
                      </div>
                    )}
                    {stressModifier !== 0 && (
                      <div className="flex items-center justify-between p-3 bg-card rounded-lg border-l-4 border-primary shadow-sm ml-2">
                        <span className="text-sm font-medium">{t('energy.stressLevel')}</span>
                        <span className={`text-lg font-bold ${stressModifier > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stressModifier > 0 ? '+' : ''}{stressModifier}
                        </span>
                      </div>
                    )}
                    {wellnessModifier !== 0 && (
                      <div className="flex items-center justify-between p-3 bg-card rounded-lg border-l-4 border-primary shadow-sm ml-2">
                        <span className="text-sm font-medium">{t('energy.wellnessIndex')}</span>
                        <span className={`text-lg font-bold ${wellnessModifier > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {wellnessModifier > 0 ? '+' : ''}{wellnessModifier}
                        </span>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Final result */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border-2 border-primary/20">
            <div className="flex items-center gap-2">
              {finalEnergy >= 70 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <span className="font-semibold">{t('energy.finalEnergy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${getEnergyColor(finalEnergy)}`}>
                {finalEnergy}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>

          {/* Energy bar */}
          <div className="space-y-1">
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${getBarColor(finalEnergy)} transition-all duration-500`}
                style={{ width: `${finalEnergy}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {finalEnergy >= 70 && t('energy.excellentEnergy')}
              {finalEnergy >= 40 && finalEnergy < 70 && t('energy.moderateEnergy')}
              {finalEnergy < 40 && t('energy.lowEnergy')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
