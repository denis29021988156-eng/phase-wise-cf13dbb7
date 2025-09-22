import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Heart, Calendar, Brain } from 'lucide-react';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error: any) {
      toast({
        title: 'Ошибка входа',
        description: error.message || 'Произошла ошибка при входе через Google',
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
          <CardHeader className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Heart className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-card-foreground">
                Wellness Calendar
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                Ваш персональный менструальный календарь с ИИ-помощником
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center space-y-2">
                <Calendar className="h-8 w-8 text-primary" />
                <span className="text-xs text-muted-foreground">Календарь</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Heart className="h-8 w-8 text-primary" />
                <span className="text-xs text-muted-foreground">Цикл</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Brain className="h-8 w-8 text-primary" />
                <span className="text-xs text-muted-foreground">ИИ-советы</span>
              </div>
            </div>

            <Button 
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ boxShadow: 'var(--wellness-glow)' }}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
                  <span>Вход...</span>
                </div>
              ) : (
                <>
                  <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Войти через Google
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Вход позволит синхронизировать данные с Google Календарем и получить персональные ИИ-советы
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;