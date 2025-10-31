import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span>❤️</span>
          Половая активность
        </h4>
        <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-3 border border-border/50">
          {sexData.some(d => d.value !== null) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sexData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  stroke="hsl(var(--border))"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  tickFormatter={(value) => value === 1 ? 'Да' : 'Нет'}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const value = payload[0].value;
                      return (
                        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="text-xs" style={{ color: 'hsl(340 70% 65%)' }}>
                            {value === 1 ? 'Да' : value === 0 ? 'Нет' : 'Нет данных'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="hsl(340 70% 65%)" 
                  radius={[8, 8, 0, 0]}
                  maxBarSize={25}
                />
              </BarChart>
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
