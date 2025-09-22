import { Calendar, User, MessageCircle, LogOut } from 'lucide-react';
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
    { id: 'calendar', label: 'Календарь', icon: Calendar },
    { id: 'profile', label: 'Профиль', icon: User },
    { id: 'chat', label: 'ИИ-чат', icon: MessageCircle },
  ];

  return (
    <nav className="bg-card border-t border-border p-4">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex space-x-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeTab === id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center space-y-1 h-auto py-2 px-3 ${
                activeTab === id 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="flex flex-col items-center space-y-1 h-auto py-2 px-3 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-xs">Выход</span>
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;