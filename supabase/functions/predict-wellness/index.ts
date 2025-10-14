import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate fast baseline predictions
const generateBaselinePredictions = (cycle: any) => {
  const today = new Date();
  const cycleStart = cycle?.start_date ? new Date(cycle.start_date) : today;
  const daysSinceStart = Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
  
  return Array.from({ length: 30 }, (_, i) => {
    const cycleDay = ((daysSinceStart + i + 1) % (cycle?.cycle_length || 28)) + 1;
    let wellness = 50;
    let note = '';
    
    if (cycleDay <= (cycle?.menstrual_length || 5)) {
      wellness = 35 + Math.random() * 20; // 35-55
      note = 'Менструация: рекомендуется больше отдыха';
    } else if (cycleDay <= 13) {
      wellness = 65 + Math.random() * 20; // 65-85
      note = 'Фолликулярная фаза: высокая энергия';
    } else if (cycleDay <= 15) {
      wellness = 80 + Math.random() * 15; // 80-95
      note = 'Овуляция: пик энергии и активности';
    } else {
      wellness = 50 + Math.random() * 20; // 50-70
      note = 'Лютеиновая фаза: умеренная активность';
    }
    
    return {
      day: i + 1,
      wellness: Math.round(wellness),
      note
    };
  });
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

    // Get cycle data quickly
    const { data: cycle } = await supabase
      .from('user_cycles')
      .select('start_date, cycle_length, menstrual_length')
      .eq('user_id', user.id)
      .single();

    // Return baseline predictions immediately
    const baselinePredictions = generateBaselinePredictions(cycle);
    
    // Start AI enhancement in background (don't await)
    if (openaiApiKey) {
      const enhanceInBackground = async () => {
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('age, weight, height')
            .eq('user_id', user.id)
            .single();

          const { data: symptoms } = await supabase
            .from('symptom_logs')
            .select('date, wellness_index, energy, mood, sleep_quality, stress_level')
            .eq('user_id', user.id)
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: false })
            .limit(15);

          const symptomsContext = symptoms?.map(s => 
            `${s.date}: wellness=${s.wellness_index}`
          ).join(', ') || 'No history';

          const prompt = `Based on menstrual cycle data, predict wellness (0-100) for next 30 days.
Cycle: ${cycle?.cycle_length || 28} days, menstrual: ${cycle?.menstrual_length || 5} days
Recent wellness: ${symptomsContext}
Age: ${profile?.age || 'unknown'}

Return ONLY a JSON array with 30 objects: [{"day":1,"wellness":65,"note":"brief"}]
Phases: menstruation (low 35-55), follicular (rising 65-85), ovulation (peak 80-95), luteal (moderate 50-70)`;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Return only valid JSON array.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.5,
              max_tokens: 1500,
            }),
          });

          if (response.ok) {
            const aiData = await response.json();
            const content = aiData.choices[0].message.content.trim();
            const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const aiPredictions = JSON.parse(jsonContent);
            
            // Save enhanced predictions to cache
            console.log('AI predictions generated:', aiPredictions.length);
            
            const today = new Date().toISOString().split('T')[0];
            await supabase
              .from('wellness_predictions')
              .upsert({
                user_id: user.id,
                prediction_date: today,
                predictions: aiPredictions
              }, {
                onConflict: 'user_id,prediction_date'
              });
            
            console.log('AI predictions saved to cache');
          }
        } catch (error) {
          console.error('Background AI enhancement failed:', error);
        }
      };

      // Start background task but don't wait
      enhanceInBackground().catch(console.error);
    }

    return new Response(
      JSON.stringify({ predictions: baselinePredictions }),
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
