import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, User, Calendar, Settings } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    cycle_length: 28,
    menstrual_length: 5,
  });

  // Load user cycle data
  useEffect(() => {
    if (user) {
      loadUserCycle();
    }
  }, [user]);

  const loadUserCycle = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_cycles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setFormData({
          start_date: data.start_date,
          cycle_length: data.cycle_length,
          menstrual_length: data.menstrual_length || 5,
        });
      }
    } catch (error) {
      console.error('Error loading user cycle:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_cycles')
        .upsert({
          user_id: user.id,
          start_date: formData.start_date,
          cycle_length: formData.cycle_length,
          menstrual_length: formData.menstrual_length,
        });

      if (error) throw error;

      toast({
        title: 'Настройки сохранены',
        description: 'Ваши данные о цикле успешно обновлены',
      });
    } catch (error) {
      console.error('Error saving cycle data:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить данные',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentDay = () => {
    if (!formData.start_date) return null;
    
    // Normalize both dates to midnight for accurate day calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(formData.start_date + 'T00:00:00');
    startDate.setHours(0, 0, 0, 0);
    
    const diffInDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const cycleDay = (diffInDays % formData.cycle_length) + 1;
    
    return cycleDay > 0 ? cycleDay : formData.cycle_length + cycleDay;
  };

  const getCyclePhase = (cycleDay: number) => {
    if (cycleDay >= 1 && cycleDay <= formData.menstrual_length) {
      return { name: 'Менструация', color: 'text-red-500' };
    } else if (cycleDay >= formData.menstrual_length + 1 && cycleDay <= 13) {
      return { name: 'Фолликулярная фаза', color: 'text-green-500' };
    } else if (cycleDay >= 14 && cycleDay <= 16) {
      return { name: 'Овуляция', color: 'text-purple-500' };
    } else {
      return { name: 'Лютеиновая фаза', color: 'text-blue-500' };
    }
  };

  const getNextPeriodDate = () => {
    if (!formData.start_date) return null;

    const startDate = new Date(formData.start_date);
    const today = new Date();

    const diffInDays = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const cycles = diffInDays >= 0
      ? Math.floor(diffInDays / formData.cycle_length) + 1
      : 0;

    const nextPeriod = new Date(startDate);
    if (cycles > 0) {
      nextPeriod.setDate(startDate.getDate() + cycles * formData.cycle_length);
    }

    return nextPeriod.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  };

  const currentDay = calculateCurrentDay();
  const currentPhase = currentDay ? getCyclePhase(currentDay) : null;
  const nextPeriod = getNextPeriodDate();

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Профиль</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Current Cycle Info */}
      {currentDay && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Текущий цикл</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-2xl font-bold text-primary">{currentDay}</div>
                <div className="text-sm text-muted-foreground">День цикла</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-accent/5 border border-accent/20">
                <div className="text-2xl font-bold text-accent">{formData.cycle_length}</div>
                <div className="text-sm text-muted-foreground">Длительность цикла</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                <div className="text-2xl font-bold text-secondary">{formData.menstrual_length}</div>
                <div className="text-sm text-muted-foreground">Длительность месячных</div>
              </div>
            </div>
            
            {/* Current Phase */}
            {currentPhase && (
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Текущая фаза:</span>
                  <span className={`font-semibold ${currentPhase.color}`}>{currentPhase.name}</span>
                </div>
              </div>
            )}
            
            {/* Next Period Date */}
            {nextPeriod && (
              <div className="mt-3 p-4 rounded-lg bg-muted/30 border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Следующие месячные:</span>
                  <span className="font-semibold text-foreground">{nextPeriod}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cycle Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-primary" />
            <span>Данные о цикле</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="start_date">Дата начала последней менструации</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="cycle_length">Продолжительность цикла (дни)</Label>
              <Input
                id="cycle_length"
                type="number"
                min="21"
                max="35"
                value={formData.cycle_length}
                onChange={(e) => setFormData({ ...formData, cycle_length: parseInt(e.target.value) })}
                className="mt-2"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Обычно от 21 до 35 дней
              </p>
            </div>

            <div>
              <Label htmlFor="menstrual_length">Длительность месячных (дни)</Label>
              <Input
                id="menstrual_length"
                type="number"
                min="3"
                max="7"
                value={formData.menstrual_length}
                onChange={(e) => setFormData({ ...formData, menstrual_length: parseInt(e.target.value) })}
                className="mt-2"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                Обычно от 3 до 7 дней
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                  <span>Сохранение...</span>
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить настройки
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Calendar Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Подключение календаря</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Google Календарь</p>
                <p className="text-sm text-muted-foreground">Подключен</p>
              </div>
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;