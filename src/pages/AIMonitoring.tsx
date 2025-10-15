import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, AlertCircle, CheckCircle2, Clock, TrendingUp, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

interface AIStats {
  total_suggestions: number;
  accepted_suggestions: number;
  rejected_suggestions: number;
  emails_sent: number;
  success_rate: number;
  avg_execution_time_ms: number;
  critical_errors: number;
}

interface RecentError {
  id: string;
  error_type: string;
  severity: string;
  message: string;
  created_at: string;
}

const AIMonitoring = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AIStats | null>(null);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);
  const [operationBreakdown, setOperationBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user, selectedDays]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-ai-stats', {
        body: { days: selectedDays },
      });

      if (error) throw error;

      setStats(data.stats);
      setRecentErrors(data.recent_errors || []);
      setOperationBreakdown(data.operation_breakdown || {});
    } catch (error) {
      console.error('Error loading AI stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Войдите для просмотра статистики</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Мониторинг</h1>
          <p className="text-muted-foreground">Статистика работы AI-ассистента</p>
        </div>
        <Tabs value={selectedDays.toString()} onValueChange={(v) => setSelectedDays(parseInt(v))}>
          <TabsList>
            <TabsTrigger value="7">7 дней</TabsTrigger>
            <TabsTrigger value="30">30 дней</TabsTrigger>
            <TabsTrigger value="90">90 дней</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Основные метрики */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Всего предложений</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_suggestions || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.success_rate || 0}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Среднее время</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.avg_execution_time_ms || 0}ms</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Критические ошибки</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats?.critical_errors || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Детальная статистика */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Статус предложений</CardTitle>
                <CardDescription>Распределение по статусам</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Принято</span>
                  </div>
                  <span className="font-bold">{stats?.accepted_suggestions || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <span>Письма отправлены</span>
                  </div>
                  <span className="font-bold">{stats?.emails_sent || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span>Отклонено</span>
                  </div>
                  <span className="font-bold">{stats?.rejected_suggestions || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Операции по типам</CardTitle>
                <CardDescription>Успешность разных операций</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {operationBreakdown && Object.entries(operationBreakdown).map(([type, counts]: [string, any]) => (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{type}</span>
                      <span className="text-muted-foreground">
                        {counts.success}/{counts.success + counts.error + counts.timeout}
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full"
                        style={{
                          width: `${(counts.success / (counts.success + counts.error + counts.timeout)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Последние ошибки */}
          {recentErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Последние ошибки</CardTitle>
                <CardDescription>Необработанные критические ошибки</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentErrors.map((error) => (
                    <div key={error.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={getSeverityColor(error.severity) as any}>
                            {error.severity}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(error.created_at).toLocaleString('ru-RU')}
                          </span>
                        </div>
                        <p className="text-sm">{error.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AIMonitoring;
