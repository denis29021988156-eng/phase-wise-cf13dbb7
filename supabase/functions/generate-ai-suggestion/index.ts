import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { event, cycleData } = await req.json();

    console.log('Generating AI suggestion for event:', event.title);
    console.log('Cycle data:', cycleData);

    // Use the database function to generate suggestion
    const { data: suggestionData, error: suggestionError } = await supabaseClient
      .rpc('generate_ai_suggestion_content', {
        event_title: event.title,
        cycle_day: cycleData.cycleDay,
        cycle_length: cycleData.cycleLength,
        event_description: event.description || null
      });

    if (suggestionError) {
      console.error('Error generating suggestion:', suggestionError);
      throw suggestionError;
    }

    const suggestion = suggestionData;
    const justification = `Совет основан на ${cycleData.cycleDay} дне цикла (продолжительность ${cycleData.cycleLength} дней)`;

    console.log('Generated suggestion:', suggestion);

    return new Response(
      JSON.stringify({ 
        suggestion, 
        justification,
        cycleDay: cycleData.cycleDay,
        cycleLength: cycleData.cycleLength
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-ai-suggestion function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});