import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ChartDataPoint {
  date: string;
  value: number | null;
  systolic?: number;
  diastolic?: number;
}

export function HealthMetricsCharts({ userId }: { userId: string }) {
  const [weightData, setWeightData] = useState<ChartDataPoint[]>([]);
  const [pressureData, setPressureData] = useState<ChartDataPoint[]>([]);
  const [sexData, setSexData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistoricalData();
  }, [userId]);

  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      
      // Fetch last 30 days
      const startDate = subDays(new Date(), 30);
      
      const { data, error } = await supabase
        .from('symptom_logs')
        .select('date, weight, blood_pressure_systolic, blood_pressure_diastolic, had_sex')
        .eq('user_id', userId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;

      if (data) {
        // Process weight data
        const weight = data.map(d => ({
          date: format(new Date(d.date), 'dd MMM', { locale: ru }),
          value: d.weight || null
        })).filter(d => d.value !== null);
        setWeightData(weight);

        // Process pressure data
        const pressure = data.map(d => ({
          date: format(new Date(d.date), 'dd MMM', { locale: ru }),
          systolic: d.blood_pressure_systolic || null,
          diastolic: d.blood_pressure_diastolic || null,
          value: d.blood_pressure_systolic || null
        })).filter(d => d.systolic !== null && d.diastolic !== null);
        setPressureData(pressure);

        // Process sex data - show as bar chart with 1 for yes, 0 for no
        const sex = data.map(d => ({
          date: format(new Date(d.date), 'dd MMM', { locale: ru }),
          value: d.had_sex === true ? 1 : d.had_sex === false ? 0 : null
        })).filter(d => d.value !== null);
        setSexData(sex);
      }
    } catch (error) {
      console.error('Error fetching health metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-40 bg-muted/30 animate-pulse rounded-xl" />
        <div className="h-40 bg-muted/30 animate-pulse rounded-xl" />
        <div className="h-40 bg-muted/30 animate-pulse rounded-xl" />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-xs font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Weight Chart */}
      {weightData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>⚖️</span>
            Динамика веса
          </h4>
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-3 border border-border/50">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
                  domain={['dataMin - 1', 'dataMax + 1']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  name="Вес (кг)"
                  stroke="hsl(245 45% 58%)" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(245 45% 58%)', r: 4 }}
                  activeDot={{ r: 6, fill: 'hsl(340 70% 65%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Blood Pressure Chart */}
      {pressureData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>🩺</span>
            Динамика давления
          </h4>
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-3 border border-border/50">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={pressureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
                  domain={[60, 160]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="systolic" 
                  name="Верхнее"
                  stroke="hsl(0 72% 51%)" 
                  strokeWidth={2.5}
                  dot={{ fill: 'hsl(0 72% 51%)', r: 3 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="diastolic" 
                  name="Нижнее"
                  stroke="hsl(245 45% 58%)" 
                  strokeWidth={2.5}
                  dot={{ fill: 'hsl(245 45% 58%)', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sexual Activity Chart */}
      {sexData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>❤️</span>
            Половая активность
          </h4>
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl p-3 border border-border/50">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={sexData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  stroke="hsl(var(--border))"
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
                      return (
                        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="text-xs" style={{ color: 'hsl(340 70% 65%)' }}>
                            {payload[0].value === 1 ? 'Да' : 'Нет'}
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
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {weightData.length === 0 && pressureData.length === 0 && sexData.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Нет данных для отображения.<br />
          Начните добавлять параметры каждый день.
        </div>
      )}
    </div>
  );
}
