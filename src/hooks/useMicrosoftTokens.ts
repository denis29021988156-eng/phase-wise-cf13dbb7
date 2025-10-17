import { useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

export const useMicrosoftTokens = () => {
  const { session, user } = useAuth();

  useEffect(() => {
    const storeTokensFromSession = async () => {
      if (!session || !user) return;

      const providerToken = session.provider_token;
      const providerRefreshToken = session.provider_refresh_token;
      
      // Check all identities for Microsoft/Azure provider
      const azureIdentity = session.user.identities?.find(
        identity => identity.provider === 'azure'
      );
      
      // CRITICAL: Only store Microsoft tokens if user logged in directly with Microsoft
      // When linking identities, session.provider_token contains the PRIMARY provider's token
      // Check if the current auth method is actually Microsoft/Azure
      const isDirectMicrosoftLogin = session.user.app_metadata?.provider === 'azure' || 
                                      session.user.app_metadata?.provider === 'microsoft';
      
      if (providerToken && azureIdentity && isDirectMicrosoftLogin) {
        try {
          // Ensure profile exists first to avoid FK constraint errors
          await supabase
            .from('user_profiles')
            .upsert({ user_id: user.id }, { onConflict: 'user_id' });

          await supabase
            .from('user_tokens')
            .upsert({
              user_id: user.id,
              provider: 'microsoft',
              access_token: providerToken,
              refresh_token: providerRefreshToken || null,
              expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
            }, { onConflict: 'user_id,provider' });
          
          console.log('Microsoft tokens stored successfully');
        } catch (error) {
          console.error('Error storing Microsoft tokens:', error);
        }
      } else if (azureIdentity && !isDirectMicrosoftLogin) {
        console.log('Microsoft identity linked, but not logged in with Microsoft - tokens not saved from session');
      }
    };

    storeTokensFromSession();
  }, [session, user]);
};
