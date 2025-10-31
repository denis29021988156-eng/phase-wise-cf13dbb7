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

    // 4. Calculate impact for each event (in points: 0-100 scale)
    let totalEnergyImpact = 0;
    let totalStressImpact = 0;
    const eventsWithImpact = [];

    for (const event of (todayEvents || [])) {
      const timeOfDay = getTimeOfDay(new Date(event.start_time));

      // Call calculate-event-coefficient with FULL event title
      const { data: coeffData, error: coeffError } = await supabase.functions.invoke(
        'calculate-event-coefficient',
        {
          body: {
            eventType: event.title, // Use full title, not classified
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
      // Convert coefficient (-0.5..0.5) to points (-25..25)
      const impactPoints = Math.round(finalImpact * 50);
      totalEnergyImpact += impactPoints;

      eventsWithImpact.push({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        eventType: event.title, // Store full title
        timeOfDay,
        cyclePhase,
        energyImpact: impactPoints, // Now in points
        stressImpact: 0
      });
    }

    // 5. Get base energy for phase (0-100 scale)
    const baseEnergyByPhase: Record<string, number> = {
      'menstrual': 40,
      'follicular': 70,
      'ovulation': 85,
      'luteal': 55
    };
    const baseEnergy = baseEnergyByPhase[cyclePhase] || 60;

    // 6. Calculate modifiers from symptoms (in points)
    let sleepModifier = 0;
    let stressModifier = 0;
    let wellnessModifier = 0;

    if (todaySymptoms) {
      sleepModifier = Math.round(((todaySymptoms.sleep_quality || 3) - 3) * 5);
      stressModifier = Math.round(((todaySymptoms.stress_level || 3) - 3) * -3);
      // Wellness index as modifier: (wellness_index - 60) × 0.3
      wellnessModifier = Math.round(((todaySymptoms.wellness_index || 60) - 60) * 0.3);
    }

    // 7. Calculate final energy (0-100 scale)
    const rawFinalEnergy = baseEnergy + totalEnergyImpact + sleepModifier + stressModifier + wellnessModifier;
    const finalEnergy = Math.max(0, Math.min(100, Math.round(rawFinalEnergy)));

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
      baseEnergy: baseEnergy,
      events: eventsWithImpact,
      totalEnergyImpact: totalEnergyImpact,
      totalStressImpact: totalStressImpact,
      sleepModifier: sleepModifier,
      stressModifier: stressModifier,
      wellnessModifier: wellnessModifier,
      finalEnergy: finalEnergy,
      confidence: Math.round(confidence),
      symptoms: todaySymptoms?.physical_symptoms || [],
      wellnessIndex: todaySymptoms?.wellness_index || null,
      calculation: {
        base: baseEnergy,
        events: totalEnergyImpact,
        sleep: sleepModifier,
        stress: stressModifier,
        wellness: wellnessModifier,
        formula: `${baseEnergy} ${totalEnergyImpact >= 0 ? '+' : ''} ${totalEnergyImpact} ${sleepModifier >= 0 ? '+' : ''} ${sleepModifier} ${stressModifier >= 0 ? '+' : ''} ${stressModifier} ${wellnessModifier >= 0 ? '+' : ''} ${wellnessModifier} = ${finalEnergy}`
      }
    };

    console.log('Energy breakdown result:', JSON.stringify(result, null, 2));

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
