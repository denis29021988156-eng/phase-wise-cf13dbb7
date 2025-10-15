import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// Дефолтные лимиты для разных эндпоинтов
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  'ai-chat': { maxRequests: 30, windowMs: 60000 }, // 30 запросов в минуту
  'ai-week-planner': { maxRequests: 10, windowMs: 60000 }, // 10 запросов в минуту
  'generate-ai-suggestion': { maxRequests: 20, windowMs: 60000 }, // 20 запросов в минуту
  'ai-generate-email-preview': { maxRequests: 15, windowMs: 60000 }, // 15 запросов в минуту
  'ai-handle-event-move': { maxRequests: 10, windowMs: 60000 }, // 10 запросов в минуту
};

export async function checkRateLimit(
  supabaseClient: SupabaseClient,
  userId: string,
  endpoint: string,
  customConfig?: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = customConfig || DEFAULT_LIMITS[endpoint] || { maxRequests: 20, windowMs: 60000 };
  
  const windowStart = new Date();
  windowStart.setMilliseconds(windowStart.getMilliseconds() - config.windowMs);
  windowStart.setSeconds(0, 0); // Округлить до начала минуты

  try {
    // Получить текущий счетчик запросов в текущем окне
    const { data: existingLimit, error: fetchError } = await supabaseClient
      .from('api_rate_limits')
      .select('request_count')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .eq('window_start', windowStart.toISOString())
      .maybeSingle();

    if (fetchError) {
      console.error('Rate limit check error:', fetchError);
      return { allowed: true, remaining: config.maxRequests, resetAt: new Date(windowStart.getTime() + config.windowMs) };
    }

    const currentCount = existingLimit?.request_count || 0;

    // Проверить лимит
    if (currentCount >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(windowStart.getTime() + config.windowMs),
      };
    }

    // Увеличить счетчик
    if (existingLimit) {
      await supabaseClient
        .from('api_rate_limits')
        .update({ request_count: currentCount + 1 })
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .eq('window_start', windowStart.toISOString());
    } else {
      await supabaseClient
        .from('api_rate_limits')
        .insert({
          user_id: userId,
          endpoint,
          request_count: 1,
          window_start: windowStart.toISOString(),
        });
    }

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetAt: new Date(windowStart.getTime() + config.windowMs),
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    // В случае ошибки разрешить запрос (fail-open)
    return { allowed: true, remaining: config.maxRequests, resetAt: new Date(windowStart.getTime() + config.windowMs) };
  }
}

export function rateLimitHeaders(remaining: number, resetAt: Date) {
  return {
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.floor(resetAt.getTime() / 1000).toString(),
  };
}
