import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateCyclePhase(cycleData: any, date: string): string {
  if (!cycleData) return 'follicular';
  
  const startDate = new Date(cycleData.start_date);
  const currentDate = new Date(date);
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
    const today = new Date();
    
    // Get cycle data
    const { data: cycleData } = await supabase
      .from('user_cycles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get events for next 7 days
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return date.toISOString().split('T')[0];
    });

    const { data: weekEvents } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', weekDays[0])
      .lt('start_time', weekDays[weekDays.length - 1] + 'T23:59:59')
      .order('start_time', { ascending: true });

    // Get base wellness predictions
    const baseWellnessByPhase: Record<string, number> = {
      'menstrual': 2.0,
      'follicular': 4.0,
      'ovulation': 4.5,
      'luteal': 3.0
    };

    // Build forecast for each day
    const forecast = await Promise.all(
      weekDays.map(async (date) => {
        const cyclePhase = calculateCyclePhase(cycleData, date);
        const baseWellness = baseWellnessByPhase[cyclePhase] || 3.0;
        
        // Get events for this day
        const dayEvents = (weekEvents || []).filter(event => {
          const eventDate = new Date(event.start_time).toISOString().split('T')[0];
          return eventDate === date;
        });

        // Calculate impact for each event
        let totalEventImpact = 0;
        const eventsWithImpact = [];

        for (const event of dayEvents) {
          const timeOfDay = getTimeOfDay(new Date(event.start_time));
          
          try {
            const { data: coeffData, error: coeffError } = await supabase.functions.invoke(
              'calculate-event-coefficient',
              {
                body: {
                  eventType: event.title,
                  cyclePhase,
                  timeOfDay,
                  stressLevel: 3
                },
                headers: {
                  Authorization: authHeader
                }
              }
            );

            if (!coeffError && coeffData) {
              const impact = coeffData.finalImpact || 0;
              totalEventImpact += impact;
              
              eventsWithImpact.push({
                name: event.title,
                impact: Number(impact.toFixed(2)),
                time: new Date(event.start_time).toLocaleTimeString('ru-RU', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })
              });
            }
          } catch (error) {
            console.error(`Error calculating coefficient for event ${event.title}:`, error);
          }
        }

        // Final wellness = base + events impact (clamped 1-5)
        const finalWellness = Math.max(1, Math.min(5, baseWellness + totalEventImpact));

        return {
          date,
          wellness_index: Number(finalWellness.toFixed(1)),
          cycle_phase: cyclePhase,
          events: eventsWithImpact,
          base_wellness: baseWellness,
          events_impact: Number(totalEventImpact.toFixed(2))
        };
      })
    );

    console.log('Week forecast generated:', forecast);

    return new Response(
      JSON.stringify({ forecast }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-week-forecast-with-events:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
