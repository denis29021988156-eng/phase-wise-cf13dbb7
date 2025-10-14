import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('age, weight, height')
      .eq('user_id', user.id)
      .single();

    // Get cycle data
    const { data: cycle } = await supabase
      .from('user_cycles')
      .select('start_date, cycle_length, menstrual_length')
      .eq('user_id', user.id)
      .single();

    // Get symptom history (last 60 days)
    const { data: symptoms } = await supabase
      .from('symptom_logs')
      .select('date, wellness_index, energy, mood, sleep_quality, stress_level')
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Prepare context for AI
    const symptomsContext = symptoms?.map(s => 
      `${s.date}: wellness=${s.wellness_index}, energy=${s.energy}, mood=${s.mood?.join(',')}, sleep=${s.sleep_quality}, stress=${s.stress_level}`
    ).join('\n') || 'No history';

    const prompt = `You are a health prediction AI. Based on the user's menstrual cycle and symptom history, predict wellness index (0-100) for the next 30 days.

User data:
- Age: ${profile?.age || 'unknown'}
- Weight: ${profile?.weight || 'unknown'}
- Height: ${profile?.height || 'unknown'}
- Cycle length: ${cycle?.cycle_length || 28} days
- Menstrual length: ${cycle?.menstrual_length || 5} days
- Last cycle start: ${cycle?.start_date || 'unknown'}

Symptom history (date: wellness, energy, mood, sleep, stress):
${symptomsContext}

Return a JSON array with 30 objects, each containing:
- "day": number (1-30)
- "wellness": number (0-100)
- "note": brief explanation

Consider cycle phases:
- Menstruation (days 1-${cycle?.menstrual_length || 5}): lower energy
- Follicular (days ${(cycle?.menstrual_length || 5) + 1}-13): rising energy
- Ovulation (days 14-15): peak energy
- Luteal (days 16-${cycle?.cycle_length || 28}): declining energy

Return ONLY valid JSON array, no markdown or additional text.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a health prediction AI that returns only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    const aiData = await response.json();
    let predictions = [];
    
    try {
      const content = aiData.choices[0].message.content.trim();
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      predictions = JSON.parse(jsonContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback: generate simple predictions based on cycle
      const today = new Date();
      const cycleStart = cycle?.start_date ? new Date(cycle.start_date) : today;
      const daysSinceStart = Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
      
      predictions = Array.from({ length: 30 }, (_, i) => {
        const cycleDay = ((daysSinceStart + i + 1) % (cycle?.cycle_length || 28)) + 1;
        let wellness = 50;
        
        if (cycleDay <= (cycle?.menstrual_length || 5)) {
          wellness = 40 + Math.random() * 15; // 40-55
        } else if (cycleDay <= 13) {
          wellness = 60 + Math.random() * 20; // 60-80
        } else if (cycleDay <= 15) {
          wellness = 75 + Math.random() * 20; // 75-95
        } else {
          wellness = 45 + Math.random() * 25; // 45-70
        }
        
        return {
          day: i + 1,
          wellness: Math.round(wellness),
          note: 'Based on cycle phase'
        };
      });
    }

    return new Response(
      JSON.stringify({ predictions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in predict-wellness:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
