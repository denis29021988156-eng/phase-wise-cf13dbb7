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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting period notification check...');

    // Получаем всех пользователей с данными о цикле
    const { data: cycles, error: cyclesError } = await supabaseAdmin
      .from('user_cycles')
      .select('user_id, start_date, cycle_length');

    if (cyclesError) {
      console.error('Error fetching cycles:', cyclesError);
      throw cyclesError;
    }

    if (!cycles || cycles.length === 0) {
      console.log('No user cycles found');
      return new Response(
        JSON.stringify({ message: 'No cycles to check', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${cycles.length} users with cycle data`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let notificationsCreated = 0;

    for (const cycle of cycles) {
      try {
        // Рассчитываем следующую дату менструации
        const startDate = new Date(cycle.start_date);
        const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const cycleDay = (daysSinceStart % cycle.cycle_length) + 1;
        
        // Дней до следующей менструации
        const daysUntilNext = cycle.cycle_length - cycleDay + 1;
        
        // Дата следующей менструации
        const nextPeriodDate = new Date(today);
        nextPeriodDate.setDate(today.getDate() + daysUntilNext);
        const nextPeriodDateStr = nextPeriodDate.toISOString().split('T')[0];

        console.log(`User ${cycle.user_id}: ${daysUntilNext} days until next period`);

        // Проверяем нужно ли отправить уведомление (за 5, 3 или 1 день)
        const notificationDays = [5, 3, 1];
        
        for (const daysBefore of notificationDays) {
          if (daysUntilNext === daysBefore) {
            // Проверяем, не создано ли уже уведомление
            const { data: existingNotification } = await supabaseAdmin
              .from('notifications')
              .select('id')
              .eq('user_id', cycle.user_id)
              .eq('notification_type', 'period_reminder')
              .eq('scheduled_for', nextPeriodDateStr)
              .maybeSingle();

            if (!existingNotification) {
              // Создаем уведомление
              const messages: Record<number, { title: string; message: string }> = {
                5: {
                  title: '📅 Напоминание о менструации',
                  message: `Через 5 дней начнется новый цикл. Самое время позаботиться о себе и подготовиться.`
                },
                3: {
                  title: '🌸 Скоро начало цикла',
                  message: `Через 3 дня начнется менструация. Проверьте, всё ли необходимое у вас под рукой.`
                },
                1: {
                  title: '💫 Завтра начало цикла',
                  message: `Завтра начнется менструация. Позаботьтесь о комфорте и не планируйте слишком много дел.`
                }
              };

              const notificationData = messages[daysBefore];

              const { error: insertError } = await supabaseAdmin
                .from('notifications')
                .insert({
                  user_id: cycle.user_id,
                  notification_type: 'period_reminder',
                  title: notificationData.title,
                  message: notificationData.message,
                  scheduled_for: today.toISOString().split('T')[0],
                  sent_at: new Date().toISOString()
                });

              if (insertError) {
                console.error(`Error creating notification for user ${cycle.user_id}:`, insertError);
              } else {
                console.log(`Created ${daysBefore}-day notification for user ${cycle.user_id}`);
                notificationsCreated++;
              }
            } else {
              console.log(`Notification already exists for user ${cycle.user_id} (${daysBefore} days)`);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing cycle for user ${cycle.user_id}:`, error);
      }
    }

    console.log(`Completed. Created ${notificationsCreated} notifications`);

    return new Response(
      JSON.stringify({ 
        message: 'Period notifications check completed',
        usersChecked: cycles.length,
        notificationsCreated
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in check-period-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});