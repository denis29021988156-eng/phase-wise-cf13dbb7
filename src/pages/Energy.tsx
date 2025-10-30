import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Calendar } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

const Energy = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [energyBreakdown, setEnergyBreakdown] = useState<any>(null);
  const [weekForecast, setWeekForecast] = useState<any[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [activeTab, setActiveTab] = useState('profiler');
  const [showCalculations, setShowCalculations] = useState(true);

  useEffect(() => {
    if (user) {
      loadEnergyBreakdown();
    }
  }, [user]);

  const loadEnergyBreakdown = async () => {
    if (!user) return;
    
    setLoadingBreakdown(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-today-energy-breakdown');
      
      if (error) throw error;
      
      setEnergyBreakdown(data);
      
      const { data: predictionData, error: predError } = await supabase.functions.invoke('predict-wellness');
      if (!predError && predictionData) {
        setWeekForecast(predictionData.predictions?.slice(0, 7) || []);
      }
    } catch (error: any) {
      console.error('Error loading energy breakdown:', error);
      toast({
        title: t('symptoms.syncError'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const getPhaseEmoji = (phase: string) => {
    const emojis: Record<string, string> = {
      menstrual: '🔴',
      follicular: '🟡',
      ovulation: '🟢',
      luteal: '🟣'
    };
    return emojis[phase] || '⚪';
  };

  const getPhaseLabel = (phase: string) => {
    const labels: Record<string, string> = {
      menstrual: 'Менструация',
      follicular: 'Фолликулярная',
      ovulation: 'Овуляция',
      luteal: 'Лютеиновая'
    };
    return labels[phase] || phase;
  };

  if (loadingBreakdown) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a3a4a]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[hsl(var(--teal))] border-t-transparent"></div>
      </div>
    );
  }

  if (!energyBreakdown) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a3a4a]">
        <p className="text-white/60">Загрузка данных...</p>
      </div>
    );
  }

  const score = energyBreakdown.finalEnergy || 3.5;
  const phase = energyBreakdown.cyclePhase || 'follicular';
  const events = energyBreakdown.events || [];
  const calculation = energyBreakdown.calculation || {};

  // Mock historical data
  const historyData = Array.from({ length: 15 }, (_, i) => ({
    day: 15 - i,
    value: 2.5 + Math.random() * 2
  })).reverse();

  // Mock forecast data
  const forecastData = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: 2.5 + Math.random() * 2
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#a0e7e5] via-[#85d4d3] to-[#6bc5c3] lg:bg-[#1a3a4a]">
      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-rows-[60px_1fr_auto] lg:h-screen">
        {/* Header */}
        <header className="bg-gradient-to-r from-[#1a3a4a] to-[#154854] border-b border-white/10">
          <div className="h-full flex items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[hsl(var(--teal-light))]" />
                </div>
                Gaia Dashboard
              </h1>
              
              <nav className="flex gap-1">
                {['profiler', 'professional', 'discutidas'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'text-[hsl(var(--teal-light))] border-b-2 border-[hsl(var(--teal))]'
                        : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>
            
            <div className="text-lg font-semibold text-white/70">1920x1080</div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="grid grid-cols-[280px_1fr_320px] overflow-hidden">
          {/* LEFT SIDEBAR - Teal Gradient */}
          <aside className="bg-gradient-to-b from-[hsl(var(--teal))] to-[hsl(var(--teal-light))] overflow-y-auto">
            <div className="p-6 flex flex-col items-center text-white">
              {/* Energy Score Gauge */}
              <div className="relative w-40 h-40 mb-4">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="white"
                    strokeWidth="8"
                    strokeDasharray={`${(score / 5) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center transform rotate-0">
                  <span className="text-4xl font-bold">{score}</span>
                  <span className="text-xl opacity-80">/5</span>
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-1">Energy Score</h3>
                <p className="text-3xl font-bold">{score}/5</p>
              </div>

              {/* Phase Indicator */}
              <div className="w-full">
                <h4 className="text-sm font-medium mb-3">Phase Indicator</h4>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                  <span className="text-2xl">{getPhaseEmoji(phase)}</span>
                  <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-300"
                      style={{ width: `${(score / 5) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm mt-2 text-center opacity-90">{getPhaseLabel(phase)}</p>
              </div>
            </div>
          </aside>

          {/* CENTER - Energy Graph */}
          <main className="bg-gradient-to-br from-[#154854] to-[#1a3a4a] overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* 15 Days History */}
              <Card className="bg-[#1e4a5a]/60 border-white/10 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">15 Days History</CardTitle>
                  <p className="text-[hsl(var(--teal-light))] text-xs">Completed Band</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={historyData}>
                      <defs>
                        <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--teal))" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(var(--teal))" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="day" 
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      />
                      <YAxis 
                        domain={[0, 5]}
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a3a4a', 
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--teal))"
                        strokeWidth={2}
                        fill="url(#historyGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 30-Day Forecast */}
              <Card className="bg-[#1e4a5a]/60 border-white/10 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">30-Day Forecast</CardTitle>
                  <p className="text-[hsl(var(--teal-light))] text-xs">Complete Band</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={forecastData}>
                      <defs>
                        <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--teal))" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(var(--teal))" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="day" 
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      />
                      <YAxis 
                        domain={[0, 5]}
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a3a4a', 
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '8px',
                          color: 'white'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--teal))"
                        strokeWidth={2}
                        fill="url(#forecastGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </main>

          {/* RIGHT SIDEBAR - Dark Teal */}
          <aside className="bg-[#154854] overflow-y-auto border-l border-white/10">
            <div className="p-4 space-y-4">
              {/* Today's Events List */}
              <Card className="bg-[#1e5565]/60 border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm">Today's Events List</CardTitle>
                </CardHeader>
                <CardContent>
                  {events.length > 0 ? (
                    <ul className="space-y-2">
                      {events.slice(0, 5).map((event: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                          <span className="text-[hsl(var(--teal-light))] mt-1">•</span>
                          <span className="flex-1">{event.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-white/50 text-sm">Нет событий на сегодня</p>
                  )}
                </CardContent>
              </Card>

              {/* Calculations Breakdown */}
              <Card className="bg-[#1e5565]/60 border-white/10">
                <CardHeader 
                  className="pb-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setShowCalculations(!showCalculations)}
                >
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    Calculations Breakdown
                    <ChevronDown 
                      className={`w-4 h-4 transition-transform ${showCalculations ? 'rotate-180' : ''}`}
                    />
                  </CardTitle>
                </CardHeader>
                {showCalculations && (
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(calculation).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-white/70">{key}:</span>
                          <span className="text-white font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </aside>
        </div>

        {/* BOTTOM: Week Forecast */}
        <footer className="bg-gradient-to-r from-[#1a3a4a] to-[#154854] border-t border-white/10 overflow-y-auto">
          <div className="p-6">
            <h3 className="text-white text-lg font-semibold mb-4">Week Forecast</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-white/80 text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 font-medium text-white/60">Mês</th>
                    {weekForecast.map((day, idx) => (
                      <th key={idx} className="text-center py-2 px-3 font-medium">
                        {['Week', 'Emoest', 'Mamt', 'Mkest', 'Fasti', 'Cenl'][idx] || `Day ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-white/60">1</td>
                    {weekForecast.map((day, idx) => (
                      <td key={idx} className="text-center py-2 px-3">{Math.floor(Math.random() * 10)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 px-3 text-white/60">7</td>
                    {weekForecast.map((day, idx) => (
                      <td key={idx} className="text-center py-2 px-3">{8 + Math.floor(Math.random() * 5)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-white/60">4</td>
                    {weekForecast.map((day, idx) => (
                      <td key={idx} className="text-center py-2 px-3">{20 + Math.floor(Math.random() * 10)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden p-4 pb-24 space-y-4">
        <h1 className="text-2xl font-bold text-white">Energy Dashboard</h1>
        <p className="text-white/70 text-sm">Просмотр доступен только на десктопе</p>
      </div>
    </div>
  );
};

export default Energy;
