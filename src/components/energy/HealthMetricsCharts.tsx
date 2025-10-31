import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  value: number | null;
  systolic?: number;
  diastolic?: number;
}

export function HealthMetricsCharts({ userId, refreshTrigger }: { userId: string; refreshTrigger?: number }) {
  const [sexData, setSexData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current 2 weeks, -1 = previous, etc.

  useEffect(() => {
    fetchHistoricalData();
  }, [userId, refreshTrigger, weekOffset]);

  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range for 2 weeks based on offset
      const endDate = addDays(new Date(), weekOffset * 14);
      const startDate = subDays(endDate, 13); // 14 days total (including end date)
      
      const { data, error } = await supabase
        .from('symptom_logs')
        .select('date, had_sex')
        .eq('user_id', userId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;

      if (data) {
        // Create array of all 14 days (even if no data)
        const allDays: ChartDataPoint[] = [];
        for (let i = 0; i < 14; i++) {
          const currentDate = addDays(startDate, i);
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const dayData = data.find(d => d.date === dateStr);
          
          allDays.push({
            date: format(currentDate, 'dd MMM', { locale: ru }),
            value: dayData?.had_sex === true ? 1 : dayData?.had_sex === false ? 0 : null
          });
        }
        
        setSexData(allDays);
      }
    } catch (error) {
      console.error('Error fetching health metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const canGoForward = weekOffset === 0;
  const handlePrevious = () => setWeekOffset(prev => prev - 1);
  const handleNext = () => {
    if (weekOffset < 0) {
      setWeekOffset(prev => prev + 1);
    }
  };

  // Calculate weekly frequency and trend
  const weeklyCount = sexData.filter(d => d.value === 1).length;
  const firstWeek = sexData.slice(0, 7).filter(d => d.value === 1).length;
  const secondWeek = sexData.slice(7, 14).filter(d => d.value === 1).length;
  const trend = secondWeek > firstWeek ? 'up' : secondWeek < firstWeek ? 'down' : 'same';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          className="h-8 px-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <span className="text-xs text-muted-foreground">
          {weekOffset === 0 ? 'Последние 2 недели' : `${Math.abs(weekOffset * 2)} недели назад`}
        </span>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={canGoForward}
          className="h-8 px-2"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Sexual Activity Chart */}
      <div className="space-y-2">
        <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
          {/* Header with stats */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Половая активность
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {weeklyCount}
                </span>
                <span className="text-sm text-muted-foreground">
                  {weeklyCount === 1 ? 'раз' : weeklyCount > 1 && weeklyCount < 5 ? 'раза' : 'раз'}
                </span>
              </div>
            </div>
            {trend === 'up' && (
              <div className="bg-emerald-500/10 p-2 rounded-full">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
            )}
            {trend === 'down' && (
              <div className="bg-red-500/10 p-2 rounded-full">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
            )}
            {trend === 'same' && (
              <div className="bg-muted/50 p-2 rounded-full">
                <Minus className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Chart */}
          {sexData.some(d => d.value !== null) ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart 
                data={sexData}
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sexGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  stroke="transparent"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  hide
                  domain={[0, 1.2]}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const value = payload[0].value;
                      return (
                        <div className="bg-card border border-border rounded-lg px-2 py-1 shadow-lg">
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="text-xs text-emerald-500">
                            {value === 1 ? '✓ Да' : value === 0 ? '− Нет' : 'Нет данных'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fill="url(#sexGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Нет данных за этот период
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
