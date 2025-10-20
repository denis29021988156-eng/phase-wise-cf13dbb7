import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, User, Calendar, Settings, Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimezoneWarning } from '@/components/TimezoneWarning';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    cycle_length: 28,
    menstrual_length: 5,
  });
  const [profileData, setProfileData] = useState({
    age: '',
    height: '',
    weight: '',
    timezone: 'Europe/Moscow',
  });

  const timezones = [
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
    { value: 'Europe/Berlin', label: 'Берлин (UTC+1)' },
    { value: 'Europe/London', label: 'Лондон (UTC+0)' },
    { value: 'Europe/Paris', label: 'Париж (UTC+1)' },
    { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
    { value: 'Asia/Tokyo', label: 'Токио (UTC+9)' },
    { value: 'Asia/Shanghai', label: 'Шанхай (UTC+8)' },
    { value: 'America/Los_Angeles', label: 'Лос-Анджелес (UTC-8)' },
    { value: 'America/Chicago', label: 'Чикаго (UTC-6)' },
    { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
    { value: 'UTC', label: 'UTC' },
  ];

  // Load user cycle data
  useEffect(() => {
    if (user) {
      loadUserCycle();
      loadUserProfile();
    }
  }, [user]);

  // Subscribe to real-time updates for user_cycles
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-cycles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_cycles',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Reload cycle data when it changes
          loadUserCycle();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadUserCycle = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_cycles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
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

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('age, height, weight, timezone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }

      if (data) {
        setProfileData({
          age: data.age?.toString() || '',
          height: data.height?.toString() || '',
          weight: data.weight?.toString() || '',
          timezone: data.timezone || 'Europe/Moscow',
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Update cycle data
      const { error: cycleError } = await supabase
        .from('user_cycles')
        .upsert({
          user_id: user.id,
          start_date: formData.start_date,
          cycle_length: formData.cycle_length,
          menstrual_length: formData.menstrual_length,
        });

      if (cycleError) throw cycleError;

      // Update profile data
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          age: profileData.age ? parseInt(profileData.age) : null,
          height: profileData.height ? parseInt(profileData.height) : null,
          weight: profileData.weight ? parseFloat(profileData.weight) : null,
          timezone: profileData.timezone,
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      toast({
        title: t('profile.saveSettings'),
        description: t('profile.saveError'),
      });
    } catch (error) {
      console.error('Error saving data:', error);
      toast({
        title: t('allEvents.deleteError'),
        description: t('profile.saveError'),
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
      return { name: t('profile.menstruation'), color: 'text-red-500' };
    } else if (cycleDay >= formData.menstrual_length + 1 && cycleDay <= 13) {
      return { name: t('profile.follicular'), color: 'text-green-500' };
    } else if (cycleDay >= 14 && cycleDay <= 16) {
      return { name: t('profile.ovulation'), color: 'text-purple-500' };
    } else {
      return { name: t('profile.luteal'), color: 'text-blue-500' };
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

    const locale = t('nav.logout') === 'Logout' ? 'en-US' : 'ru-RU';
    return nextPeriod.toLocaleDateString(locale, {
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
          <h1 className="text-2xl font-bold text-foreground">{t('profile.title')}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Timezone Warning */}
      <TimezoneWarning userTimezone={profileData.timezone} />

      {/* Current Cycle Info */}
      {currentDay && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>{t('profile.currentCycle')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-2xl font-bold text-primary">{currentDay}</div>
                <div className="text-sm text-muted-foreground">{t('profile.cycleDay')}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-accent/5 border border-accent/20">
                <div className="text-2xl font-bold text-accent">{formData.cycle_length}</div>
                <div className="text-sm text-muted-foreground">{t('profile.cycleLength')}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                <div className="text-2xl font-bold text-secondary">{formData.menstrual_length}</div>
                <div className="text-sm text-muted-foreground">{t('profile.menstrualLength')}</div>
              </div>
            </div>
            
            {/* Current Phase */}
            {currentPhase && (
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('profile.currentPhase')}</span>
                  <span className={`font-semibold ${currentPhase.color}`}>{currentPhase.name}</span>
                </div>
              </div>
            )}
            
            {/* Next Period Date */}
            {nextPeriod && (
              <div className="mt-3 p-4 rounded-lg bg-muted/30 border border-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('profile.nextPeriod')}</span>
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
            <span>{t('profile.cycleData')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="start_date">{t('profile.lastPeriodStart')}</Label>
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
              <Label htmlFor="cycle_length">{t('cycleSetup.cycleLength')}</Label>
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
                {t('cycleSetup.cycleLengthHint')}
              </p>
            </div>

            <div>
              <Label htmlFor="menstrual_length">{t('cycleSetup.menstrualLength')}</Label>
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
                {t('profile.usuallyDays')}
              </p>
            </div>

            <div>
              <Label htmlFor="age">{t('profile.ageYears')}</Label>
              <Input
                id="age"
                type="number"
                min="14"
                max="85"
                value={profileData.age}
                onChange={(e) => setProfileData({ ...profileData, age: e.target.value })}
                className="mt-2"
                placeholder={t('profile.agePlaceholder')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('profile.ageRange')}
              </p>
            </div>

            <div>
              <Label htmlFor="height">{t('profile.heightCm')}</Label>
              <Input
                id="height"
                type="number"
                min="120"
                max="220"
                value={profileData.height}
                onChange={(e) => setProfileData({ ...profileData, height: e.target.value })}
                className="mt-2"
                placeholder={t('profile.heightPlaceholder')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('profile.heightRange')}
              </p>
            </div>

            <div>
              <Label htmlFor="weight">{t('profile.weightKg')}</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="30"
                max="150"
                value={profileData.weight}
                onChange={(e) => setProfileData({ ...profileData, weight: e.target.value })}
                className="mt-2"
                placeholder={t('profile.weightPlaceholder')}
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('profile.weightRange')}
              </p>
            </div>

            <div>
              <Label htmlFor="timezone" className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>{t('profile.timezone')}</span>
              </Label>
              <Select
                value={profileData.timezone}
                onValueChange={(value) => setProfileData({ ...profileData, timezone: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('profile.timezonePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {t('profile.timezoneUsed')}
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
                  <span>{t('cycleSetup.saving')}</span>
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('profile.saveSettings')}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Calendar Connection */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.calendarConnection')}</CardTitle>
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
                <p className="font-medium">{t('profile.googleCalendar')}</p>
                <p className="text-sm text-muted-foreground">{t('profile.connected')}</p>
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