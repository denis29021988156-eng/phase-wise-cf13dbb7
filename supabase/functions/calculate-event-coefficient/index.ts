import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventCoefficientRequest {
  eventType: string;
  cyclePhase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  stressLevel?: number;
}

interface EventCoefficientResult {
  baseCoefficient: number;
  cycleModifier: number;
  timeModifier: number;
  stressCoefficient: number;
  finalImpact: number;
  isAiEstimate?: boolean;
}

function getPhaseColumn(phase: string): string {
  switch (phase) {
    case 'menstrual': return 'menstrual';
    case 'follicular': return 'follicular';
    case 'ovulation': return 'ovulation';
    case 'luteal': return 'luteal';
    default: return 'follicular';
  }
}

function getTimeColumn(time: string): string {
  switch (time) {
    case 'morning': return 'morning';
    case 'afternoon': return 'afternoon';
    case 'evening': return 'evening';
    default: return 'afternoon';
  }
}

async function callAIToEstimateEvent(eventType: string): Promise<number> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY_NEW');
  
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, returning default estimate');
    return -0.2; // Default neutral-negative impact
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert in women's wellness and energy management. Estimate the base energy impact coefficient for an event on a scale from -1.0 (high energy drain) to +1.0 (high energy restoration). 

Examples:
- Intense work/conflict: -0.7 to -1.0
- Moderate work: -0.3 to -0.5
- Light activities: -0.1 to -0.2
- Rest/recovery: +0.3 to +0.8
- Deep sleep: +0.8 to +1.0

Respond with ONLY a number between -1.0 and +1.0, no explanation.`
          },
          {
            role: 'user',
            content: `Estimate the base energy impact coefficient for this event: "${eventType}"`
          }
        ],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const estimate = parseFloat(data.choices[0].message.content.trim());
    
    // Validate the estimate is in valid range
    if (isNaN(estimate) || estimate < -1 || estimate > 1) {
      console.warn(`Invalid AI estimate: ${estimate}, using default`);
      return -0.2;
    }

    console.log(`AI estimated coefficient for "${eventType}": ${estimate}`);
    return estimate;
  } catch (error) {
    console.error('Error calling AI for event estimate:', error);
    return -0.2; // Default fallback
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { eventType, cyclePhase, timeOfDay, stressLevel = 3 }: EventCoefficientRequest = await req.json();

    console.log(`Calculating coefficient for: ${eventType}, phase: ${cyclePhase}, time: ${timeOfDay}, stress: ${stressLevel}`);

    // 1. Query the energy_reference table
    const { data: event, error } = await supabaseClient
      .from('energy_reference')
      .select('*')
      .eq('event_name', eventType)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to query energy reference data');
    }

    let result: EventCoefficientResult;

    if (!event) {
      // Event not found - use AI to estimate
      console.log(`Event "${eventType}" not found in database, using AI estimate`);
      const aiEstimate = await callAIToEstimateEvent(eventType);
      
      result = {
        baseCoefficient: aiEstimate,
        cycleModifier: 0,
        timeModifier: 0,
        stressCoefficient: 0,
        finalImpact: aiEstimate,
        isAiEstimate: true
      };
    } else {
      // Event found - calculate with all modifiers
      const baseCoefficient = Number(event.base);
      const cycleModifier = Number(event[getPhaseColumn(cyclePhase)]);
      const timeModifier = Number(event[getTimeColumn(timeOfDay)]);
      const stressCoefficient = Number(event.stress_coefficient);

      // Calculate stress modifier: ranges from 0.5 to 1.5 based on stress level (1-5)
      const stressModifier = 1 + ((stressLevel - 3) * (stressCoefficient / 5));

      // Final formula: base + (base × cycle) + (base × time) × stressModifier
      const finalImpact = (baseCoefficient + (baseCoefficient * cycleModifier) + (baseCoefficient * timeModifier)) * stressModifier;

      result = {
        baseCoefficient,
        cycleModifier,
        timeModifier,
        stressCoefficient,
        finalImpact: Number(finalImpact.toFixed(3)),
        isAiEstimate: false
      };
    }

    console.log('Calculation result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calculate-event-coefficient:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
