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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const url = new URL(req.url);
    const daysBack = parseInt(url.searchParams.get('days') || '7');

    // Получить статистику через функцию БД
    const { data: stats, error } = await supabaseClient.rpc('get_ai_stats', {
      days_back: daysBack,
    });

    if (error) throw error;

    // Получить последние необработанные ошибки
    const { data: recentErrors } = await supabaseClient
      .from('ai_error_notifications')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // Получить статистику по типам операций
    const { data: operationStats } = await supabaseClient
      .from('ai_operation_metrics')
      .select('operation_type, status')
      .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());

    const operationBreakdown = operationStats?.reduce((acc: any, item: any) => {
      const key = item.operation_type;
      if (!acc[key]) {
        acc[key] = { success: 0, error: 0, timeout: 0 };
      }
      acc[key][item.status]++;
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        recent_errors: recentErrors,
        operation_breakdown: operationBreakdown,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-ai-stats:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
