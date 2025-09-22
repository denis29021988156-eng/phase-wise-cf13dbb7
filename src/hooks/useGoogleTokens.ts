import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleTokens = () => {
  const { session, user } = useAuth();

  useEffect(() => {
    const storeTokensFromSession = async () => {
      if (!session || !user) return;

      const providerToken = session.provider_token;
      const providerRefreshToken = session.provider_refresh_token;
      
      if (providerToken && session.user.app_metadata.provider === 'google') {
        try {
          await supabase
            .from('user_tokens')
            .upsert({
              user_id: user.id,
              provider: 'google',
              access_token: providerToken,
              refresh_token: providerRefreshToken || null,
              expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
            });
          
          console.log('Google tokens stored successfully');
        } catch (error) {
          console.error('Error storing Google tokens:', error);
        }
      }
    };

    storeTokensFromSession();
  }, [session, user]);
};