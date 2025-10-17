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
      
      // CRITICAL: Only store Google tokens if user logged in directly with Google
      // When linking identities, session.provider_token contains the PRIMARY provider's token
      const isDirectGoogleLogin = session.user.app_metadata?.provider === 'google';
      
      if (providerToken && googleIdentity && isDirectGoogleLogin) {
        try {
          // Ensure profile exists first to avoid FK constraint errors
          await supabase
            .from('user_profiles')
            .upsert({ user_id: user.id }, { onConflict: 'user_id' });

          await supabase
            .from('user_tokens')
            .upsert({
              user_id: user.id,
              provider: 'google',
              access_token: providerToken,
              refresh_token: providerRefreshToken || null,
              expires_at: session.expires_at 
                ? new Date(session.expires_at * 1000).toISOString() 
                : null,
            }, { onConflict: 'user_id,provider' });
          
          console.log('Google tokens stored successfully');
        } catch (error) {
          console.error('Error storing Google tokens:', error);
        }
      }
    };

    storeTokensFromSession();
  }, [session, user]);
};