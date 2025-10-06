import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useGoogleTokens } from '@/hooks/useGoogleTokens';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/layout/Navigation';
import Calendar from './Calendar';
import AllEvents from './AllEvents';
import Profile from './Profile';
import Chat from './Chat';
import CycleSetup from './CycleSetup';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Store Google tokens when available
  useGoogleTokens();
  const [activeTab, setActiveTab] = useState('calendar');
  const [needsCycleSetup, setNeedsCycleSetup] = useState(false);
  const [checkingCycle, setCheckingCycle] = useState(true);
  const navRef = useRef<HTMLDivElement | null>(null);
  const [navHeight, setNavHeight] = useState(0);

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

  // Measure bottom navigation height and reserve space to prevent overlap
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const update = () => setNavHeight(Math.ceil(el.getBoundingClientRect().height));
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (loading || checkingCycle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
          <span className="text-sm text-muted-foreground font-medium">Загрузка...</span>
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
      case 'all-events':
        return <AllEvents />;
      case 'profile':
        return <Profile />;
      case 'chat':
        return <Chat />;
      default:
        return <Calendar />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <main className="pb-6">
        {renderActiveTab()}
      </main>

      {/* Spacer to reserve space for the fixed bottom navigation */}
      <div aria-hidden className="w-full" style={{ height: navHeight }} />

      {/* Fixed bottom navigation with safe-area padding */}
      <div
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
};

export default Index;
