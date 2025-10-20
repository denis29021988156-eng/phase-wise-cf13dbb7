import { Calendar, User, MessageCircle, LogOut, List, Heart, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: t('auth.signOut'),
        description: t('auth.goodbye'),
      });
    } catch (error: any) {
      toast({
        title: t('auth.error'),
        description: t('auth.signOutError'),
        variant: 'destructive',
      });
    }
  };

  const tabs = [
    { id: 'calendar', label: t('nav.tasks'), icon: Calendar },
    { id: 'all-events', label: t('nav.allEvents'), icon: List },
    { id: 'profile', label: t('nav.profile'), icon: User },
    { id: 'chat', label: t('nav.chat'), icon: MessageCircle },
    { id: 'symptoms', label: t('nav.symptoms'), icon: Heart },
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
          onClick={toggleLanguage}
          className="flex flex-col items-center justify-center gap-1.5 h-auto py-2.5 px-3 min-w-[70px] text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-accent/10"
        >
          <Globe className="h-5 w-5 stroke-[1.5]" />
          <span className="text-[10px] font-medium whitespace-nowrap">{i18n.language.toUpperCase()}</span>
        </Button>
        
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center gap-1.5 h-auto py-2.5 px-3 min-w-[70px] text-muted-foreground hover:text-destructive transition-all duration-200 hover:bg-destructive/5"
        >
          <LogOut className="h-5 w-5 stroke-[1.5]" />
          <span className="text-[10px] font-medium whitespace-nowrap">{t('nav.logout')}</span>
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;