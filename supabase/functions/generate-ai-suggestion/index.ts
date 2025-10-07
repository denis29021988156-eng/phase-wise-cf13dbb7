import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Определяем фазы цикла и их описания
const getCyclePhase = (cycleDay: number, cycleLength: number = 28, menstrualLength: number = 5) => {
  if (cycleDay >= 1 && cycleDay <= menstrualLength) {
    return {
      phase: 'Менструация',
      description: 'снижение энергии, потребность в отдыхе, возможные болевые ощущения, эмоциональная чувствительность'
    };
  } else if (cycleDay >= menstrualLength + 1 && cycleDay <= 13) {
    return {
      phase: 'Фолликулярная фаза',
      description: 'повышение энергии, улучшение настроения, активность, хорошая концентрация'
    };
  } else if (cycleDay >= 14 && cycleDay <= 16) {
    return {
      phase: 'Овуляция',
      description: 'пик энергии, социальная активность, повышенная привлекательность, возможны тянущие боли'
    };
  } else {
    return {
      phase: 'Лютеиновая фаза',
      description: 'постепенное снижение энергии, возможная раздражительность, потребность в комфорте, изменения аппетита'
    };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key не настроен');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { event, cycleData, timezone = 'UTC' } = await req.json();

    console.log('Generating AI suggestion for event:', event.title);
    console.log('Cycle data:', cycleData);

    // Get user from auth
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Пользователь не аутентифицирован');
    }

    // Get user profile for name
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get recent chat history to understand user's health context (last 10 messages)
    const { data: recentMessages } = await supabaseClient
      .from('chat_messages')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(10);

    // Build health context from recent messages
    let healthContext = '';
    if (recentMessages && recentMessages.length > 0) {
      const healthKeywords = ['болею', 'болит', 'устала', 'плохо', 'больно', 'недомогание', 'головная боль', 'спина', 'живот', 'тошнит', 'слабость'];
      const relevantMessages = recentMessages.filter(msg => 
        healthKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
      );
      
      if (relevantMessages.length > 0) {
        healthContext = `\nКонтекст самочувствия из недавних сообщений:\n${relevantMessages.map(msg => `- ${msg.content}`).join('\n')}\n`;
      }
    }

    const { phase, description } = getCyclePhase(cycleData.cycleDay, cycleData.cycleLength, cycleData.menstrualLength || 5);
    // Используем локальное время, если оно передано, иначе форматируем из ISO
    const eventTime = event.start_time_local || new Date(event.start_time).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone
    });

    const userName = profile?.name ? profile.name : 'дорогая';

    const prompt = `
Ты — помощник по женскому здоровью. Оцени событие с учетом цикла и самочувствия.

Контекст:
- ${cycleData.cycleDay}-й день цикла (${phase})
- Особенности: ${description}
- Событие: «${event.title}»
- Время: ${eventTime}${healthContext}

Напиши развернутую оценку для ${userName} (4-6 предложений): влияние фазы, энергия, концентрация, эмоции, практические советы, альтернативы.

ВАРИАНТЫ НАЧАЛА (варьируй):
"${userName}, смотри..." / "Слушай, ${userName}..." / "Знаешь, ${userName}..." / "${userName}, давай разберем..." / "${userName}, тут важно учесть..."

${healthContext ? 'ВАЖНО: Учти информацию о самочувствии в рекомендациях!' : ''}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Ты заботливый ИИ-помощник для женского здоровья. Отвечай на русском языке.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const suggestion = data.choices[0].message.content;
    const justification = `ИИ-совет для ${phase.toLowerCase()} (${cycleData.cycleDay} день цикла)`;

    console.log('Generated AI suggestion:', suggestion);

    return new Response(
      JSON.stringify({ 
        suggestion, 
        justification,
        cycleDay: cycleData.cycleDay,
        cycleLength: cycleData.cycleLength,
        phase: phase
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-ai-suggestion function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});