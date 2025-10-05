import { Calendar, User, MessageCircle, LogOut, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: 'Выход выполнен',
        description: 'До свидания!',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при выходе',
        variant: 'destructive',
      });
    }
  };

  const tabs = [
    { id: 'calendar', label: 'Задачи', icon: Calendar },
    { id: 'all-events', label: 'Все события', icon: List },
    { id: 'profile', label: 'Профиль', icon: User },
    { id: 'chat', label: 'Gaia AI', icon: MessageCircle },
  ];

  return (
    <nav className="bg-card/80 backdrop-blur-xl border-t border-border/20 p-4">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex space-x-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeTab === id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center gap-1 h-auto py-2 px-3 transition-all duration-300 ${
                activeTab === id 
                  ? 'shadow-[var(--shadow-glow)] scale-105' 
                  : 'text-muted-foreground hover:text-foreground hover:scale-105'
              }`}
            >
              <Icon className="h-5 w-5 stroke-[1.5]" />
              <span className="text-xs font-medium">{label}</span>
            </Button>
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 h-auto py-2 px-3 text-muted-foreground hover:text-destructive transition-all duration-300 hover:scale-105"
        >
          <LogOut className="h-5 w-5 stroke-[1.5]" />
          <span className="text-xs font-medium">Выход</span>
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;