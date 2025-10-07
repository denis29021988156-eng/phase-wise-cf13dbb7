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
    { id: 'chat', label: 'Gaia', icon: MessageCircle },
  ];

  return (
    <nav className="bg-card/95 backdrop-blur-xl border-t border-border shadow-[var(--shadow-medium)]">
      <div className="flex items-center justify-around max-w-2xl mx-auto px-4 py-3 safe-bottom">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeTab === id ? 'default' : 'ghost'}
            onClick={() => onTabChange(id)}
            className={`flex flex-col items-center justify-center gap-1.5 h-auto py-2.5 px-3 min-w-[70px] transition-all duration-200 ${
              activeTab === id 
                ? 'bg-primary text-primary-foreground shadow-[var(--shadow-soft)]' 
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
            }`}
          >
            <Icon className="h-5 w-5 stroke-[1.5]" />
            <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
          </Button>
        ))}
        
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center gap-1.5 h-auto py-2.5 px-3 min-w-[70px] text-muted-foreground hover:text-destructive transition-all duration-200 hover:bg-destructive/5"
        >
          <LogOut className="h-5 w-5 stroke-[1.5]" />
          <span className="text-[10px] font-medium whitespace-nowrap">Выход</span>
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;