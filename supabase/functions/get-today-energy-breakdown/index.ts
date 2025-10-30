import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateCyclePhase(cycleData: any, today: string): string {
  if (!cycleData) return 'follicular';
  
  const startDate = new Date(cycleData.start_date);
  const currentDate = new Date(today);
  const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const cycleDay = (daysSinceStart % cycleData.cycle_length) + 1;
  
  if (cycleDay <= cycleData.menstrual_length) {
    return 'menstrual';
  } else if (cycleDay <= 13) {
    return 'follicular';
  } else if (cycleDay <= 15) {
    return 'ovulation';
  } else {
    return 'luteal';
  }
}

function getTimeOfDay(datetime: Date): string {
  const hour = datetime.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function classifyEventType(title: string): string {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('тренировка') || lowerTitle.includes('спорт') || lowerTitle.includes('workout')) {
    return 'Тренировка';
  } else if (lowerTitle.includes('встреча') || lowerTitle.includes('meeting')) {
    return 'Встреча';
  } else if (lowerTitle.includes('работа') || lowerTitle.includes('work')) {
    return 'Работа';
  } else if (lowerTitle.includes('отдых') || lowerTitle.includes('rest')) {
    return 'Отдых';
  } else if (lowerTitle.includes('еда') || lowerTitle.includes('meal')) {
    return 'Питание';
  }
  
  return 'Другое';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;
    const today = new Date().toISOString().split('T')[0];

    // 1. Get cycle data
    const { data: cycleData, error: cycleError } = await supabase
      .from('user_cycles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (cycleError) {
      console.error('Cycle error:', cycleError);
    }

    const cyclePhase = calculateCyclePhase(cycleData, today);

    // 2. Get today's events
    const { data: todayEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', `${today}T00:00:00`)
      .lt('start_time', `${today}T23:59:59`)
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Events error:', eventsError);
    }

    // 3. Get today's symptoms
    const { data: todaySymptoms, error: symptomsError } = await supabase
      .from('symptom_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (symptomsError) {
      console.error('Symptoms error:', symptomsError);
    }

    // 4. Calculate impact for each event
    let totalEnergyImpact = 0;
    let totalStressImpact = 0;
    const eventsWithImpact = [];

    for (const event of (todayEvents || [])) {
      const timeOfDay = getTimeOfDay(new Date(event.start_time));
      const eventType = classifyEventType(event.title);

      // Call calculate-event-coefficient
      const { data: coeffData, error: coeffError } = await supabase.functions.invoke(
        'calculate-event-coefficient',
        {
          body: {
            eventType,
            cyclePhase,
            timeOfDay,
            stressLevel: todaySymptoms?.stress_level || 3
          }
        }
      );

      if (coeffError) {
        console.error('Coefficient error:', coeffError);
        continue;
      }

      const { finalImpact } = coeffData;
      totalEnergyImpact += finalImpact;

      eventsWithImpact.push({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        eventType,
        timeOfDay,
        cyclePhase,
        energyImpact: finalImpact,
        stressImpact: 0
      });
    }

    // 5. Get base energy for phase
    const baseEnergyByPhase: Record<string, number> = {
      'menstrual': 2.0,
      'follicular': 4.0,
      'ovulation': 4.5,
      'luteal': 3.0
    };
    const baseEnergy = baseEnergyByPhase[cyclePhase] || 3.0;

    // 6. Calculate modifiers from symptoms
    let sleepModifier = 0;
    let stressModifier = 0;

    if (todaySymptoms) {
      sleepModifier = ((todaySymptoms.sleep_quality || 3) - 3) * 0.15;
      stressModifier = ((todaySymptoms.stress_level || 3) - 3) * -0.1;
    }

    // 7. Calculate final energy
    const rawFinalEnergy = baseEnergy + totalEnergyImpact + sleepModifier + stressModifier;
    const finalEnergy = Math.max(1, Math.min(5, rawFinalEnergy));

    // 8. Calculate confidence
    const { data: recentLogs } = await supabase
      .from('symptom_logs')
      .select('date')
      .eq('user_id', userId)
      .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    const recentDays = recentLogs?.length || 0;
    const confidence = Math.min(100, 50 + (recentDays * 1.5));

    const result = {
      today,
      cyclePhase,
      baseEnergy: Math.round(baseEnergy * 100) / 100,
      events: eventsWithImpact,
      totalEnergyImpact: Math.round(totalEnergyImpact * 100) / 100,
      totalStressImpact: Math.round(totalStressImpact * 100) / 100,
      sleepModifier: Math.round(sleepModifier * 100) / 100,
      stressModifier: Math.round(stressModifier * 100) / 100,
      finalEnergy: Math.round(finalEnergy * 10) / 10,
      confidence: Math.round(confidence),
      symptoms: todaySymptoms?.physical_symptoms || [],
      calculation: {
        base: Math.round(baseEnergy * 100) / 100,
        events: Math.round(totalEnergyImpact * 100) / 100,
        sleep: Math.round(sleepModifier * 100) / 100,
        stress: Math.round(stressModifier * 100) / 100,
        formula: `${baseEnergy.toFixed(2)} + ${totalEnergyImpact.toFixed(2)} + ${sleepModifier.toFixed(2)} + ${stressModifier.toFixed(2)} = ${finalEnergy.toFixed(1)}`
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-today-energy-breakdown:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
