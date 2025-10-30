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
            .select('age, weight, height, language, timezone')
            .eq('user_id', user.id)
            .maybeSingle();

          const language = profile?.language || 'ru';
          const isEnglish = language === 'en';
          const timezone = profile?.timezone || 'UTC';

          // Get detailed symptom logs for last 30 days
          const { data: symptoms } = await supabase
            .from('symptom_logs')
            .select('date, wellness_index, energy, mood, sleep_quality, stress_level, physical_symptoms')
            .eq('user_id', user.id)
            .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: false })
            .limit(30);

          // Get recent chat messages for health context
          const { data: recentMessages } = await supabase
            .from('chat_messages')
            .select('content, created_at')
            .eq('user_id', user.id)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(10);

          // Get upcoming events for next 30 days
          const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: upcomingEvents } = await supabase
            .from('events')
            .select('title, start_time, end_time')
            .eq('user_id', user.id)
            .gte('start_time', new Date().toISOString())
            .lte('start_time', thirtyDaysFromNow)
            .order('start_time', { ascending: true });

          // Check if Apple Health data is synced
          const healthDataSynced = symptoms?.some(s => s.sleep_quality || s.stress_level) || false;

          // Build detailed symptom context
          const moodLabels: Record<string, Record<string, string>> = {
            en: {
              happy: 'joy', calm: 'calmness', anxious: 'anxiety',
              irritable: 'irritation', sad: 'sadness', motivated: 'motivation'
            },
            ru: {
              happy: 'радость', calm: 'спокойствие', anxious: 'тревога',
              irritable: 'раздражение', sad: 'грусть', motivated: 'вдохновение'
            }
          };
          const physicalLabels: Record<string, Record<string, string>> = {
            en: {
              pain: 'pain', fatigue: 'fatigue', energy: 'energy',
              cramps: 'cramps', headache: 'headache', bloating: 'bloating'
            },
            ru: {
              pain: 'боль', fatigue: 'усталость', energy: 'бодрость',
              cramps: 'спазмы', headache: 'головная боль', bloating: 'вздутие'
            }
          };
          
          const lang = isEnglish ? 'en' : 'ru';
          
          let symptomsContext = '';
          if (symptoms && symptoms.length > 0) {
            symptomsContext = isEnglish 
              ? '\n📊 RECENT WELLNESS DATA (last 30 days):\n'
              : '\n📊 ДАННЫЕ О САМОЧУВСТВИИ (последние 30 дней):\n';
            
            symptoms.slice(0, 10).forEach(s => {
              symptomsContext += `${s.date}: `;
              symptomsContext += isEnglish 
                ? `wellness=${s.wellness_index}/100, energy=${s.energy}/5`
                : `самочувствие=${s.wellness_index}/100, энергия=${s.energy}/5`;
              
              if (s.sleep_quality) {
                symptomsContext += isEnglish 
                  ? `, sleep=${s.sleep_quality}/5`
                  : `, сон=${s.sleep_quality}/5`;
              }
              if (s.stress_level) {
                symptomsContext += isEnglish 
                  ? `, stress=${s.stress_level}/5`
                  : `, стресс=${s.stress_level}/5`;
              }
              if (s.mood && s.mood.length > 0) {
                symptomsContext += isEnglish 
                  ? `, mood: ${s.mood.map((m: string) => moodLabels[lang][m] || m).join(', ')}`
                  : `, настроение: ${s.mood.map((m: string) => moodLabels[lang][m] || m).join(', ')}`;
              }
              if (s.physical_symptoms && s.physical_symptoms.length > 0) {
                symptomsContext += isEnglish 
                  ? `, symptoms: ${s.physical_symptoms.map((p: string) => physicalLabels[lang][p] || p).join(', ')}`
                  : `, симптомы: ${s.physical_symptoms.map((p: string) => physicalLabels[lang][p] || p).join(', ')}`;
              }
              symptomsContext += '\n';
            });

            if (healthDataSynced) {
              symptomsContext += isEnglish
                ? '\n🍎 Sleep and stress data synced from Apple Health\n'
                : '\n🍎 Данные о сне и стрессе синхронизированы с Apple Health\n';
            }
          }

          // Add chat context
          let chatContext = '';
          if (recentMessages && recentMessages.length > 0) {
            const healthKeywords = isEnglish
              ? ['sick', 'hurts', 'tired', 'bad', 'pain', 'unwell', 'headache', 'back', 'stomach', 'nausea', 'weakness']
              : ['болею', 'болит', 'устала', 'плохо', 'больно', 'недомогание', 'головная боль', 'спина', 'живот', 'тошнит', 'слабость'];
            const relevantMessages = recentMessages.filter(msg => 
              healthKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
            );
            
            if (relevantMessages.length > 0) {
              chatContext = isEnglish
                ? `\n💬 Health-related messages from chat:\n${relevantMessages.map(msg => `- ${msg.content}`).join('\n')}\n`
                : `\n💬 Сообщения о здоровье из чата:\n${relevantMessages.map(msg => `- ${msg.content}`).join('\n')}\n`;
            }
          }

          // Add events context
          let eventsContext = '';
          if (upcomingEvents && upcomingEvents.length > 0) {
            eventsContext = isEnglish
              ? `\n📅 UPCOMING EVENTS (next 30 days):\n${upcomingEvents.slice(0, 15).map(e => {
                  const eventDate = new Date(e.start_time);
                  const dateStr = eventDate.toLocaleDateString(isEnglish ? 'en-US' : 'ru-RU', { timeZone: timezone });
                  const timeStr = eventDate.toLocaleTimeString(isEnglish ? 'en-US' : 'ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: timezone 
                  });
                  return `${dateStr} ${timeStr}: ${e.title}`;
                }).join('\n')}\n`
              : `\n📅 ПРЕДСТОЯЩИЕ СОБЫТИЯ (ближайшие 30 дней):\n${upcomingEvents.slice(0, 15).map(e => {
                  const eventDate = new Date(e.start_time);
                  const dateStr = eventDate.toLocaleDateString('ru-RU', { timeZone: timezone });
                  const timeStr = eventDate.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    timeZone: timezone 
                  });
                  return `${dateStr} ${timeStr}: ${e.title}`;
                }).join('\n')}\n`;
          }

          // Build profile context for more personalized predictions
          let profileInfo = '';
          if (profile) {
            const parts = [];
            if (isEnglish) {
              if (profile.age) parts.push(`Age: ${profile.age} years`);
              if (profile.height) parts.push(`Height: ${profile.height} cm`);
              if (profile.weight) parts.push(`Weight: ${profile.weight} kg`);
            } else {
              if (profile.age) parts.push(`Возраст: ${profile.age} лет`);
              if (profile.height) parts.push(`Рост: ${profile.height} см`);
              if (profile.weight) parts.push(`Вес: ${profile.weight} кг`);
            }
            if (parts.length > 0) {
              profileInfo = isEnglish
                ? `\n\n👤 USER DATA:\n${parts.join('\n')}\n(Use for personalized activity and nutrition recommendations)`
                : `\n\n👤 ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:\n${parts.join('\n')}\n(Используй для персонализации советов по активности и питанию)`;
            }
          }

          const prompt = isEnglish ? `
You are an advanced AI assistant for women's health with deep understanding of the menstrual cycle and overall well-being.

Your task: Create a detailed 30-day wellness prediction (energy balance) based on ALL available data.

📊 CYCLE DATA:
• Cycle length: ${cycle?.cycle_length || 28} days
• Menstrual period: ${cycle?.menstrual_length || 5} days
${symptomsContext}${chatContext}${eventsContext}${profileInfo}

⚠️ CRITICAL: Use ALL provided data for predictions:
• Recent wellness trends, mood, physical symptoms
• Apple Health data (sleep, stress) if available
• Health concerns from chat messages
• Upcoming events and their timing (early morning/late evening events affect energy differently)
• User's physical parameters (age, weight, height)

📋 TASK:
1. Analyze cycle phase for each of next 30 days
2. Consider recent wellness patterns and trends
3. Account for upcoming events (intense events may require more recovery)
4. Factor in physical symptoms and mood patterns
5. Use Apple Health data if available
6. Provide specific, actionable advice for each day

Return ONLY a JSON array with 30 objects:
[{"day":1,"wellness":65,"note":"Brief personalized recommendation"}]

Wellness scale:
• Menstruation (days 1-5): 35-55 (low energy, need rest)
• Follicular (days 6-13): 65-85 (rising energy, good for activity)
• Ovulation (days 14-16): 80-95 (peak energy, maximum activity)
• Luteal (days 17+): 50-70 (declining energy, moderate activity)

IMPORTANT: Adjust predictions based on actual health data, not just cycle phase!
` : `
Ты — продвинутый ИИ-помощник по женскому здоровью с глубоким пониманием менструального цикла и общего самочувствия.

Твоя задача: Создать детальный прогноз самочувствия (энергетический баланс) на 30 дней на основе ВСЕХ доступных данных.

📊 ДАННЫЕ О ЦИКЛЕ:
• Длина цикла: ${cycle?.cycle_length || 28} дней
• Длина менструации: ${cycle?.menstrual_length || 5} дней
${symptomsContext}${chatContext}${eventsContext}${profileInfo}

⚠️ КРИТИЧЕСКИ ВАЖНО: Используй ВСЕ предоставленные данные для прогноза:
• Тренды самочувствия, настроение, физические симптомы
• Данные Apple Health (сон, стресс), если доступны
• Жалобы на здоровье из сообщений в чате
• Предстоящие события и их время (события рано утром/поздно вечером влияют на энергию по-разному)
• Физические параметры пользователя (возраст, вес, рост)

📋 ЗАДАНИЕ:
1. Проанализируй фазу цикла для каждого из следующих 30 дней
2. Учти недавние паттерны самочувствия и тренды
3. Учти предстоящие события (интенсивные события требуют больше восстановления)
4. Учти физические симптомы и паттерны настроения
5. Используй данные Apple Health, если доступны
6. Дай конкретные, применимые советы для каждого дня

Верни ТОЛЬКО JSON массив с 30 объектами:
[{"day":1,"wellness":65,"note":"Краткая персонализированная рекомендация"}]

Шкала самочувствия:
• Менструация (дни 1-5): 35-55 (низкая энергия, нужен отдых)
• Фолликулярная (дни 6-13): 65-85 (рост энергии, хорошо для активности)
• Овуляция (дни 14-16): 80-95 (пик энергии, максимальная активность)
• Лютеиновая (дни 17+): 50-70 (снижение энергии, умеренная активность)

ВАЖНО: Корректируй прогнозы на основе реальных данных о здоровье, а не только фазы цикла!
`;

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { 
                  role: 'system', 
                  content: isEnglish 
                    ? 'You are an advanced AI assistant for women\'s health. Analyze ALL provided data (cycle, symptoms, mood, events, Apple Health data, chat messages) and return ONLY a valid JSON array with personalized wellness predictions. Be thorough and consider all context.'
                    : 'Ты — продвинутый ИИ-помощник по женскому здоровью. Проанализируй ВСЕ предоставленные данные (цикл, симптомы, настроение, события, данные Apple Health, сообщения) и верни ТОЛЬКО валидный JSON массив с персонализированным прогнозом. Будь тщательным и учитывай весь контекст.'
                },
                { role: 'user', content: prompt }
              ],
              temperature: 0.7,
              max_tokens: 2500,
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
