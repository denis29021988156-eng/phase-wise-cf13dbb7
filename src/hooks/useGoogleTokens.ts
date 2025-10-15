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
      
      // Check all identities for Google provider
      const googleIdentity = session.user.identities?.find(
        identity => identity.provider === 'google'
      );
      
      if (providerToken && googleIdentity) {
        try {
          await supabase
            .from('user_tokens')
            .upsert({
              user_id: user.id,
              provider: 'google',
              access_token: providerToken,
              refresh_token: providerRefreshToken || null,
              // Store null so backend refresh function always refreshes when needed
              expires_at: null,
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