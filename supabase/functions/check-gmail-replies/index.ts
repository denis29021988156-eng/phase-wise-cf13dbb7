import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting Gmail replies check...');

    // Получить все активные предложения с email_thread_id
    const { data: suggestions, error: suggestionsError } = await supabaseClient
      .from('event_move_suggestions')
      .select('*')
      .eq('status', 'email_sent')
      .not('email_thread_id', 'is', null);

    if (suggestionsError) {
      console.error('Error fetching suggestions:', suggestionsError);
      throw suggestionsError;
    }

    console.log(`Found ${suggestions?.length || 0} suggestions to check`);

    if (!suggestions || suggestions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No suggestions to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Сгруппировать по пользователю
    const userSuggestions = new Map();
    for (const suggestion of suggestions) {
      if (!userSuggestions.has(suggestion.user_id)) {
        userSuggestions.set(suggestion.user_id, []);
      }
      userSuggestions.get(suggestion.user_id).push(suggestion);
    }

    console.log(`Processing ${userSuggestions.size} users`);

    let processedCount = 0;
    let errorCount = 0;

    // Проверить каждого пользователя
    for (const [userId, userSuggs] of userSuggestions) {
      try {
        console.log(`Checking user ${userId} with ${userSuggs.length} suggestions`);

        // Получить токен пользователя
        const { data: tokenData, error: tokenError } = await supabaseClient
          .from('user_tokens')
          .select('access_token, refresh_token')
          .eq('user_id', userId)
          .eq('provider', 'google')
          .maybeSingle();

        if (tokenError || !tokenData) {
          console.error(`No token found for user ${userId}`);
          continue;
        }

        // Обновить токен
        const refreshResponse = await supabaseClient.functions.invoke('refresh-google-token', {
          body: { user_id: userId }
        });

        if (refreshResponse.error) {
          console.error(`Failed to refresh token for user ${userId}`);
          continue;
        }

        const accessToken = refreshResponse.data.access_token;

        // Проверить каждый тред
        for (const suggestion of userSuggs) {
          try {
            console.log(`Checking thread ${suggestion.email_thread_id}`);

            // Получить сообщения из треда
            const threadResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${suggestion.email_thread_id}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              }
            );

            if (!threadResponse.ok) {
              const errorText = await threadResponse.text();
              console.error(`Failed to fetch thread ${suggestion.email_thread_id}:`, threadResponse.status, errorText);
              errorCount++;
              continue;
            }

            const threadData = await threadResponse.json();
            const messages = threadData.messages || [];

            console.log(`Thread has ${messages.length} messages`);

            // Если больше одного сообщения - есть ответ
            if (messages.length > 1) {
              // Получить последнее сообщение (ответ)
              const lastMessage = messages[messages.length - 1];
              
              // Извлечь тело письма
              let emailBody = '';
              
              if (lastMessage.payload.parts) {
                for (const part of lastMessage.payload.parts) {
                  if (part.mimeType === 'text/plain' && part.body.data) {
                    emailBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                    break;
                  }
                }
              } else if (lastMessage.payload.body.data) {
                emailBody = atob(lastMessage.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              }

              console.log(`Found reply in thread ${suggestion.email_thread_id}`);

              // Вызвать функцию обработки ответа
              const handleResponse = await supabaseClient.functions.invoke('ai-handle-email-reply', {
                body: {
                  threadId: suggestion.email_thread_id,
                  emailBody,
                  userId,
                }
              });

              if (handleResponse.error) {
                console.error(`Error handling reply for thread ${suggestion.email_thread_id}:`, handleResponse.error);
                errorCount++;
              } else {
                console.log(`Successfully processed reply for thread ${suggestion.email_thread_id}`);
                processedCount++;
              }
            }
          } catch (error) {
            console.error(`Error processing thread ${suggestion.email_thread_id}:`, error);
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        errorCount++;
      }
    }

    console.log(`Check completed. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Gmail check completed',
        processed: processedCount,
        errors: errorCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in check-gmail-replies:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
