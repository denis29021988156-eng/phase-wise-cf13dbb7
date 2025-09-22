import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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

    const { message, userId } = await req.json();

    console.log('Processing AI chat message for user:', userId);
    console.log('User message:', message);

    // Get user cycle data for personalized response
    let cycleContext = '';
    try {
      const { data: cycleData } = await supabaseClient
        .from('user_cycles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (cycleData) {
        const today = new Date();
        const startDate = new Date(cycleData.start_date);
        const diffInDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const cycleDay = ((diffInDays % cycleData.cycle_length) + 1);
        const adjustedCycleDay = cycleDay > 0 ? cycleDay : cycleData.cycle_length + cycleDay;
        
        const { phase, description } = getCyclePhase(adjustedCycleDay, cycleData.cycle_length);
        
        cycleContext = `
Контекст пользователя:
- Сегодня ${adjustedCycleDay}-й день менструального цикла (из ${cycleData.cycle_length} дней)
- Текущая фаза: ${phase}
- Особенности фазы: ${description}
`;
      }
    } catch (error) {
      console.log('No cycle data found for user, proceeding without cycle context');
    }

    const systemPrompt = `
Ты — опытный и заботливый ИИ-помощник по женскому здоровью и благополучию. 
Твоя задача — предоставлять персонализированную поддержку, советы и ответы на вопросы о здоровье, самочувствии и образе жизни.

${cycleContext}

Принципы общения:
1. Будь тёплым, понимающим и поддерживающим
2. Давай конкретные, практичные советы
3. Учитывай менструальный цикл в своих рекомендациях (если информация доступна)
4. Не давай медицинских диагнозов, но предлагай обратиться к врачу при необходимости
5. Фокусируйся на холистическом подходе к здоровью
6. Отвечай на русском языке
7. Будь краткой, но информативной (3-5 предложений)

Темы, по которым ты можешь помочь:
- Самочувствие и настроение
- Питание и диета
- Физические упражнения и активность
- Сон и отдых
- Стресс и эмоциональное состояние
- Планирование активностей с учетом цикла
- Общие вопросы о женском здоровье
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('Generated AI response:', aiResponse);

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});