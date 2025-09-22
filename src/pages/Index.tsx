import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/layout/Navigation';
import Calendar from './Calendar';
import Profile from './Profile';
import Chat from './Chat';
import CycleSetup from './CycleSetup';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('calendar');
  const [needsCycleSetup, setNeedsCycleSetup] = useState(false);
  const [checkingCycle, setCheckingCycle] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Check if user needs to set up cycle data
  useEffect(() => {
    const checkCycleSetup = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_cycles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking cycle data:', error);
          setCheckingCycle(false);
          return;
        }

        if (!data) {
          // No cycle data found
          setNeedsCycleSetup(true);
        }
      } catch (error) {
        console.error('Error checking cycle setup:', error);
      } finally {
        setCheckingCycle(false);
      }
    };

    if (user && !loading) {
      checkCycleSetup();
    }
  }, [user, loading]);

  if (loading || checkingCycle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-lg text-muted-foreground">Загрузка...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show cycle setup if needed
  if (needsCycleSetup) {
    return (
      <CycleSetup onComplete={() => {
        setNeedsCycleSetup(false);
        setCheckingCycle(false);
      }} />
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'calendar':
        return <Calendar />;
      case 'profile':
        return <Profile />;
      case 'chat':
        return <Chat />;
      default:
        return <Calendar />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        {renderActiveTab()}
      </main>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t">
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
};

export default Index;
