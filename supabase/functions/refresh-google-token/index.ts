import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { user_id } = await req.json();
    
    if (!user_id) {
      throw new Error('user_id is required');
    }

    console.log(`Refreshing Google token for user: ${user_id}`);

    // Find user's Google tokens
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user_id)
      .eq('provider', 'google')
      .single();

    if (tokenError || !tokenRecord) {
      throw new Error('Google tokens not found for user');
    }

    // Check if token is still valid (with 5 minute buffer)
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);
    const fiveMinutesBuffer = 5 * 60 * 1000;
    
    if (expiresAt > new Date(now.getTime() + fiveMinutesBuffer)) {
      console.log('Token is still valid, returning current token');
      return new Response(
        JSON.stringify({ access_token: tokenRecord.access_token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token expired or expiring soon, refreshing...');

    if (!tokenRecord.refresh_token) {
      throw new Error('No refresh token available. User needs to re-authenticate.');
    }

    // Refresh the token
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        refresh_token: tokenRecord.refresh_token,
      }).toString(),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error('Google token refresh failed:', errorText);
      throw new Error('Failed to refresh Google token. User needs to re-authenticate.');
    }

    const refreshData = await refreshResponse.json();
    const newAccessToken = refreshData.access_token;
    const newRefreshToken = refreshData.refresh_token || tokenRecord.refresh_token;
    const expiresIn = refreshData.expires_in || 3600; // Default 1 hour

    // Update the token in database
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    const { error: updateError } = await supabase
      .from('user_tokens')
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: newExpiresAt,
      })
      .eq('user_id', user_id)
      .eq('provider', 'google');

    if (updateError) {
      console.error('Failed to update token in database:', updateError);
      throw new Error('Failed to update token in database');
    }

    console.log('Token refreshed successfully');

    return new Response(
      JSON.stringify({ access_token: newAccessToken }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in refresh-google-token function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});