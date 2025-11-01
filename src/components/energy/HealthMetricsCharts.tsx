import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, addDays } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChartDataPoint {
  date: string;
  value: number | null;
}

interface BloodPressureDataPoint {
  date: string;
  systolic: number | null;
  diastolic: number | null;
}

export function HealthMetricsCharts({ userId, refreshTrigger }: { userId: string; refreshTrigger?: number }) {
  const [weightData, setWeightData] = useState<ChartDataPoint[]>([]);
  const [bpData, setBpData] = useState<BloodPressureDataPoint[]>([]);
  const [sexData, setSexData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current 2 weeks, -1 = previous, etc.
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ru' ? ru : enUS;

  useEffect(() => {
    fetchHistoricalData();
  }, [userId, refreshTrigger, weekOffset]);

  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      
      // Get first record date for the user
      const { data: firstRecord } = await supabase
        .from('symptom_logs')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();

      const today = new Date();
      let endDate: Date;
      let startDate: Date;
      let daysToShow: number;

      if (weekOffset === 0 && firstRecord) {
        // For current period, check if user has less than 14 days of data
        const firstRecordDate = new Date(firstRecord.date);
        const daysSinceFirst = Math.floor((today.getTime() - firstRecordDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceFirst < 13) {
          // Show from first record to today
          startDate = firstRecordDate;
          endDate = today;
          daysToShow = daysSinceFirst + 1;
        } else {
          // Show last 14 days
          endDate = today;
          startDate = subDays(endDate, 13);
          daysToShow = 14;
        }
      } else {
        // For historical periods, always show 14 days
        endDate = addDays(today, weekOffset * 14);
        startDate = subDays(endDate, 13);
        daysToShow = 14;
      }
      
      const { data, error } = await supabase
        .from('symptom_logs')
        .select('date, had_sex, weight, blood_pressure_systolic, blood_pressure_diastolic')
        .eq('user_id', userId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;

      if (data) {
        // Create array of all days in the range
        const allDays: ChartDataPoint[] = [];
        const allWeightDays: ChartDataPoint[] = [];
        const allBpDays: BloodPressureDataPoint[] = [];
        
        for (let i = 0; i < daysToShow; i++) {
          const currentDate = addDays(startDate, i);
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const dayData = data.find(d => d.date === dateStr);
          
          // Sex data
          allDays.push({
            date: format(currentDate, 'dd MMM', { locale }),
            value: dayData?.had_sex === true ? 1 : dayData?.had_sex === false ? 0 : null
          });
          
          // Weight data
          allWeightDays.push({
            date: format(currentDate, 'dd MMM', { locale }),
            value: dayData?.weight ? Number(dayData.weight) : null
          });
          
          // Blood pressure data
          allBpDays.push({
            date: format(currentDate, 'dd MMM', { locale }),
            systolic: dayData?.blood_pressure_systolic || null,
            diastolic: dayData?.blood_pressure_diastolic || null
          });
        }
        
        setSexData(allDays);
        setWeightData(allWeightDays);
        setBpData(allBpDays);
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

  // Calculate trends for each metric
  const sexWeeklyCount = sexData.filter(d => d.value === 1).length;
  const sexFirstWeek = sexData.slice(0, 7).filter(d => d.value === 1).length;
  const sexSecondWeek = sexData.slice(7, 14).filter(d => d.value === 1).length;
  const sexTrend = sexSecondWeek > sexFirstWeek ? 'up' : sexSecondWeek < sexFirstWeek ? 'down' : 'same';

  // Weight trend
  const weightValues = weightData.filter(d => d.value !== null).map(d => d.value!);
  const weightFirstHalf = weightData.slice(0, Math.floor(weightData.length / 2)).filter(d => d.value !== null).map(d => d.value!);
  const weightSecondHalf = weightData.slice(Math.floor(weightData.length / 2)).filter(d => d.value !== null).map(d => d.value!);
  const weightAvgFirst = weightFirstHalf.length > 0 ? weightFirstHalf.reduce((a, b) => a + b, 0) / weightFirstHalf.length : 0;
  const weightAvgSecond = weightSecondHalf.length > 0 ? weightSecondHalf.reduce((a, b) => a + b, 0) / weightSecondHalf.length : 0;
  const weightTrend = weightAvgSecond > weightAvgFirst ? 'up' : weightAvgSecond < weightAvgFirst ? 'down' : 'same';
  const currentWeight = weightValues.length > 0 ? weightValues[weightValues.length - 1] : null;

  // Blood pressure trend (using systolic)
  const bpSystolicValues = bpData.filter(d => d.systolic !== null).map(d => d.systolic!);
  const bpFirstHalf = bpData.slice(0, Math.floor(bpData.length / 2)).filter(d => d.systolic !== null).map(d => d.systolic!);
  const bpSecondHalf = bpData.slice(Math.floor(bpData.length / 2)).filter(d => d.systolic !== null).map(d => d.systolic!);
  const bpAvgFirst = bpFirstHalf.length > 0 ? bpFirstHalf.reduce((a, b) => a + b, 0) / bpFirstHalf.length : 0;
  const bpAvgSecond = bpSecondHalf.length > 0 ? bpSecondHalf.reduce((a, b) => a + b, 0) / bpSecondHalf.length : 0;
  const bpTrend = bpAvgSecond > bpAvgFirst ? 'up' : bpAvgSecond < bpAvgFirst ? 'down' : 'same';
  const latestBp = bpData.filter(d => d.systolic !== null && d.diastolic !== null).slice(-1)[0];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
      </div>
    );
  }

  const renderTrendIcon = (trend: string) => {
    if (trend === 'up') {
      return (
        <div className="bg-emerald-500/10 p-2 rounded-full">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </div>
      );
    }
    if (trend === 'down') {
      return (
        <div className="bg-red-500/10 p-2 rounded-full">
          <TrendingDown className="w-5 h-5 text-red-500" />
        </div>
      );
    }
    return (
      <div className="bg-muted/50 p-2 rounded-full">
        <Minus className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  };

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
          {weekOffset === 0 ? t('energy.lastTwoWeeks') : t('energy.weeksAgo', { count: Math.abs(weekOffset * 2) })}
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

      {/* Weight Chart */}
      <div className="space-y-2">
        <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t('energy.weight')}
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {currentWeight ? currentWeight.toFixed(1) : '—'}
                </span>
                <span className="text-sm text-muted-foreground">{t('energy.kg')}</span>
              </div>
            </div>
            {renderTrendIcon(weightTrend)}
          </div>

          {weightData.some(d => d.value !== null) ? (
            <ResponsiveContainer width="100%" height={141}>
              <AreaChart 
                data={weightData}
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const value = payload[0].value;
                      return (
                        <div className="bg-card border border-border rounded-lg px-2 py-1 shadow-lg">
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="text-xs text-blue-500">
                            {value ? `${Number(value).toFixed(1)} ${t('energy.kg')}` : t('energy.noDataPeriod')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fill="url(#weightGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t('energy.noDataPeriod')}
            </div>
          )}
        </div>
      </div>

      {/* Blood Pressure Chart */}
      <div className="space-y-2">
        <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t('energy.pressure')}
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {latestBp ? `${latestBp.systolic}/${latestBp.diastolic}` : '—'}
                </span>
              </div>
            </div>
            {renderTrendIcon(bpTrend)}
          </div>

          {bpData.some(d => d.systolic !== null || d.diastolic !== null) ? (
            <ResponsiveContainer width="100%" height={141}>
              <AreaChart 
                data={bpData}
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="systolicGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="diastolicGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
                  domain={[60, 160]}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border border-border rounded-lg px-2 py-1 shadow-lg">
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          {payload[0].value && (
                            <p className="text-xs text-orange-500">
                              {t('energy.systolic')}: {payload[0].value}
                            </p>
                          )}
                          {payload[1]?.value && (
                            <p className="text-xs text-purple-500">
                              {t('energy.diastolic')}: {payload[1].value}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ stroke: '#f97316', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="systolic" 
                  stroke="#f97316" 
                  strokeWidth={3}
                  fill="url(#systolicGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#f97316', strokeWidth: 0 }}
                  connectNulls
                />
                <Area 
                  type="monotone" 
                  dataKey="diastolic" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  fill="url(#diastolicGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t('energy.noDataPeriod')}
            </div>
          )}
        </div>
      </div>

      {/* Sexual Activity Chart */}
      <div className="space-y-2">
        <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm">
          {/* Header with stats */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                {t('energy.sexualActivity')}
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">
                  {sexWeeklyCount}
                </span>
                <span className="text-sm text-muted-foreground">
                  {i18n.language === 'ru' 
                    ? (sexWeeklyCount === 1 ? 'раз' : sexWeeklyCount > 1 && sexWeeklyCount < 5 ? 'раза' : 'раз')
                    : (sexWeeklyCount === 1 ? t('energy.time') : t('energy.times'))
                  }
                </span>
              </div>
            </div>
            {renderTrendIcon(sexTrend)}
          </div>

          {/* Chart */}
          {sexData.some(d => d.value !== null) ? (
            <ResponsiveContainer width="100%" height={141}>
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
                            {value === 1 ? `✓ ${t('energy.yes')}` : value === 0 ? `− ${t('energy.no')}` : t('energy.noDataPeriod')}
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
              {t('energy.noDataPeriod')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
