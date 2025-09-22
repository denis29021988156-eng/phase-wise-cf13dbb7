import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event, cycleData } = await req.json();
    
    console.log('Generating AI suggestion for event:', event);
    console.log('Cycle data:', cycleData);

    // Use the database function to generate suggestion
    const { data: suggestionData, error: suggestionError } = await supabase
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
    const justification = `На основе ${cycleData.cycleDay} дня цикла (из ${cycleData.cycleLength} дней)`;

    console.log('Generated suggestion:', suggestion);

    return new Response(JSON.stringify({ 
      suggestion,
      justification
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in generate-ai-suggestion function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate suggestion'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});