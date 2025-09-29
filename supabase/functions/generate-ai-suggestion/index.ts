import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY_NEW');

// Определяем фазы цикла и их описания
const getCyclePhase = (cycleDay: number, cycleLength: number = 28) => {
  if (cycleDay >= 1 && cycleDay <= 5) {
    return {
      phase: 'Менструация',
      description: 'снижение энергии, потребность в отдыхе, возможные болевые ощущения, эмоциональная чувствительность'
    };
  } else if (cycleDay >= 6 && cycleDay <= 13) {
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

    const { event, cycleData } = await req.json();

    console.log('Generating AI suggestion for event:', event.title);
    console.log('Cycle data:', cycleData);

    const { phase, description } = getCyclePhase(cycleData.cycleDay, cycleData.cycleLength);
    const eventTime = new Date(event.start_time).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const prompt = `
Ты — помощник по женскому здоровью. Дай практичный совет для события с учетом менструального цикла.

Контекст:
- ${cycleData.cycleDay}-й день цикла (${phase})
- Особенности: ${description}
- Событие: «${event.title}»
- Время: ${eventTime}

Напиши краткий совет (4-6 предложений):
1. Как лучше подготовиться к событию
2. Конкретные рекомендации по самочувствию
3. Стоит ли перенести или можно оставить на это время

Пиши простым языком, без формальных фраз. Сразу давай конкретные советы.
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