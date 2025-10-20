import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n/config';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  linkGoogleIdentity: () => Promise<void>;
  linkMicrosoftIdentity: () => Promise<void>;
  linkAppleIdentity: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Load user's language preference when they log in
        if (session?.user) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('language')
            .eq('user_id', session.user.id)
            .maybeSingle();
          
          if (profile?.language && profile.language !== i18n.language) {
            i18n.changeLanguage(profile.language);
            localStorage.setItem('language', profile.language);
          }
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Load user's language preference
      if (session?.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('language')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (profile?.language && profile.language !== i18n.language) {
          i18n.changeLanguage(profile.language);
          localStorage.setItem('language', profile.language);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',  
      options: {
        redirectTo: redirectUrl,
        scopes: 'openid profile email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
        }
      }
    });
    
    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const linkGoogleIdentity = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        scopes: 'openid profile email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
        }
      }
    });
    
    if (error) {
      console.error('Error linking Google identity:', error);
      throw error;
    }
  };

  const signInWithMicrosoft = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: redirectUrl,
        scopes: 'openid profile email offline_access Calendars.ReadWrite',
      }
    });
    
    if (error) {
      console.error('Error signing in with Microsoft:', error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
      }
    });
    
    if (error) {
      console.error('Error signing in with Apple:', error);
      throw error;
    }
  };

  const linkMicrosoftIdentity = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.linkIdentity({
      provider: 'azure',
      options: {
        redirectTo: redirectUrl,
        scopes: 'openid profile email offline_access Calendars.ReadWrite',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });
    
    if (error) {
      console.error('Error linking Microsoft identity:', error);
      throw error;
    }
  };

  const linkAppleIdentity = async () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.linkIdentity({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
      }
    });
    
    if (error) {
      console.error('Error linking Apple identity:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithApple,
    linkGoogleIdentity,
    linkMicrosoftIdentity,
    linkAppleIdentity,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};