import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Calendar } from 'lucide-react';

interface CycleSetupProps {
  onComplete: () => void;
}

const CycleSetup = ({ onComplete }: CycleSetupProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    start_date: '',
    cycle_length: 28,
    menstrual_length: 5,
    age: '',
    height: '',
    weight: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: 'Ошибка авторизации',
        description: 'Пользователь не найден. Попробуйте войти заново.',
        variant: 'destructive',
      });
      return;
    }

    console.log('Attempting to save cycle data for user:', user.id);
    console.log('Form data:', formData);

    setLoading(true);
    try {
      // Save cycle data
      const { error: cycleError } = await supabase
        .from('user_cycles')
        .insert({
          user_id: user.id,
          start_date: formData.start_date,
          cycle_length: formData.cycle_length,
          menstrual_length: formData.menstrual_length,
        });

      if (cycleError) {
        console.error('Supabase cycle error:', cycleError);
        throw cycleError;
      }

      // Save or update profile data with age, height, weight
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          age: formData.age ? parseInt(formData.age) : null,
          height: formData.height ? parseInt(formData.height) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('Supabase profile error:', profileError);
        throw profileError;
      }

      toast({
        title: 'Настройки сохранены',
        description: 'Добро пожаловать в CycleON!',
      });
      
      // Invalidate prediction cache since cycle data changed
      await supabase
        .from('wellness_predictions')
        .delete()
        .eq('user_id', user.id);
      
      onComplete();
    } catch (error: any) {
      console.error('Error saving cycle data:', error);
      toast({
        title: 'Ошибка сохранения',
        description: error.message || 'Не удалось сохранить данные о цикле',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" 
         style={{ background: 'var(--wellness-gradient)' }}>
      <div className="w-full max-w-md">
        <Card className="backdrop-blur-sm bg-card/90 border-0 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Heart className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-card-foreground">
                Настройка цикла
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Введите данные для персональных рекомендаций
              </p>
            </div>
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
                  max="45"
                  value={formData.cycle_length}
                  onChange={(e) => setFormData({ ...formData, cycle_length: parseInt(e.target.value) })}
                  className="mt-2"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Обычно от 21 до 45 дней
                </p>
              </div>

              <div>
                <Label htmlFor="menstrual_length">Длительность менструации (дни)</Label>
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

              <div className="space-y-4 pt-4 border-t border-border">
                <p className="text-sm font-medium text-card-foreground">
                  Дополнительная информация (для персонализации)
                </p>
                
                <div>
                  <Label htmlFor="age">Возраст (лет)</Label>
                  <Input
                    id="age"
                    type="number"
                    min="14"
                    max="85"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="mt-2"
                    placeholder="Укажите ваш возраст"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    От 14 до 85 лет
                  </p>
                </div>

                <div>
                  <Label htmlFor="height">Рост (см)</Label>
                  <Input
                    id="height"
                    type="number"
                    min="120"
                    max="220"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    className="mt-2"
                    placeholder="Укажите ваш рост"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    От 120 до 220 см
                  </p>
                </div>

                <div>
                  <Label htmlFor="weight">Вес (кг)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    min="30"
                    max="150"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="mt-2"
                    placeholder="Укажите ваш вес"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    От 30 до 150 кг
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                style={{ boxShadow: 'var(--wellness-glow)' }}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
                    <span>Сохранение...</span>
                  </div>
                ) : (
                  <>
                    <Calendar className="h-5 w-5 mr-2" />
                    Войти в приложение
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CycleSetup;