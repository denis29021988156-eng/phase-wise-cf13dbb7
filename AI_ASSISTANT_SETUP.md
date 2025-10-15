# Настройка AI-ассистента PhaseWise - Полное руководство

## 🎯 Обзор

PhaseWise использует AI-ассистента "Gaia" для помощи в планировании событий с учетом менструального цикла.

### Данные пользователя в AI-анализе

**Все AI-ассистенты учитывают:**
- ✅ **Возраст** (age) - для возрастных особенностей и рекомендаций
- ✅ **Рост** (height) - для оценки физической нагрузки
- ✅ **Вес** (weight) - для персонализации советов по активности

**Где используется:**
- `ai-chat` - персонализация советов по питанию и активности
- `generate-ai-suggestion` - учет физической нагрузки при оценке событий
- `ai-week-planner` - оценка допустимой нагрузки в расписании
- `predict-wellness` - точность прогнозов самочувствия
- `ai-generate-email-preview` - контекст для генерации писем

---

## ✅ РЕАЛИЗОВАННЫЕ УЛУЧШЕНИЯ (2025-01-15)

### 1. ✅ Разделение Google и Microsoft Event ID
**Статус:** ✅ Реализовано

**Изменения:**
- Добавлено отдельное поле `microsoft_event_id` в таблицу `events`
- Google события используют `google_event_id`
- Microsoft/Outlook события используют `microsoft_event_id`
- Созданы индексы для быстрого поиска обоих полей
- Обновлен код синхронизации для корректного сохранения ID

**Миграция выполнена автоматически.**

---

### 2. ✅ Настроенные Cron Jobs
**Статус:** ✅ Автоматически настроено

#### Активные Cron Jobs:

**`ai-week-planner-daily`** - Каждый день в 9:00 UTC (12:00 МСК)
- Анализирует события на неделю вперед
- Создает предложения по переносу встреч с учетом фазы цикла
- Добавляет сообщения в чат пользователя

**`cleanup-ai-logs-daily`** - Каждый день в 2:00 UTC
- Удаляет retry логи старше 7 дней
- Очищает метрики старше 30 дней
- Удаляет resolved уведомления об ошибках старше 7 дней

**`cleanup-rate-limits-hourly`** - Каждый час
- Удаляет записи rate limiting старше 1 часа

**`cleanup-rejected-suggestions-weekly`** - Каждое воскресенье в 3:00 UTC
- Удаляет отклоненные предложения старше 30 дней

**Проверка статуса:**
```sql
SELECT * FROM cron.job;
```

**Проверка последних выполнений:**
```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC LIMIT 10;
```

---

### 3. ✅ Rate Limiting для AI-запросов
**Статус:** ✅ Реализовано

#### Лимиты по эндпоинтам:
| Эндпоинт | Макс. запросов | Временное окно |
|----------|----------------|----------------|
| `ai-chat` | 30 | 1 минута |
| `ai-week-planner` | 10 | 1 минута |
| `generate-ai-suggestion` | 20 | 1 минута |
| `ai-generate-email-preview` | 15 | 1 минута |
| `ai-handle-event-move` | 10 | 1 минута |

**Как работает:**
1. Создана таблица `api_rate_limits` для отслеживания запросов
2. Каждый запрос к AI проверяется через `checkRateLimit()`
3. При превышении лимита возвращается HTTP 429 (Too Many Requests)
4. Заголовки ответа содержат информацию:
   - `X-RateLimit-Remaining`: оставшихся запросов
   - `X-RateLimit-Reset`: время сброса лимита (unix timestamp)

**Настройка лимитов:**
Редактировать файл `supabase/functions/_shared/rate-limiter.ts`:
```typescript
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  'ai-chat': { maxRequests: 30, windowMs: 60000 },
  // ... другие эндпоинты
};
```

---

### 4. ⚠️ Leaked Password Protection
**Статус:** ⚠️ Требует ручной настройки

**Инструкция:**

1. Откройте [Supabase Dashboard → Authentication](https://supabase.com/dashboard/project/pytefsexxwtlropzkmxi/auth/providers)
2. Перейдите в раздел **Policies**
3. Найдите **"Password Strength and Leaked Password Protection"**
4. Включите опцию **"Check for leaked passwords"**
5. Настройте требования к паролю:
   - ✅ Минимум 8 символов
   - ✅ Хотя бы одна заглавная буква  
   - ✅ Хотя бы одна цифра
   - ✅ Хотя бы один специальный символ

**Ссылка на документацию:**
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 📋 КОМПОНЕНТЫ СИСТЕМЫ

### База данных

**Основные таблицы:**
- `events` - события календаря (Google/Microsoft)
- `event_move_suggestions` - предложения AI по переносу
- `chat_messages` - история чата с Gaia
- `user_cycles` - данные менструального цикла
- `ai_retry_logs` - логи повторных попыток
- `ai_operation_metrics` - метрики производительности AI
- `ai_error_notifications` - уведомления об ошибках
- `api_rate_limits` - отслеживание лимитов запросов

### Edge Functions

**`ai-week-planner`** (ежедневно, cron)
- Анализирует календарь на 7 дней вперед
- Создает предложения по переносу событий
- Учитывает фазу цикла и плотность расписания

**`ai-chat`** (по запросу)
- Обрабатывает сообщения пользователя
- Rate limiting: 30 запросов/минуту
- Сохраняет историю в БД

**`ai-handle-event-move`** (по запросу)
- Генерирует и отправляет письма участникам
- Rate limiting: 10 запросов/минуту
- Поддержка Gmail и Microsoft Graph API

**`ai-generate-email-preview`** (по запросу)  
- Генерирует preview письма через OpenAI
- Rate limiting: 15 запросов/минуту

**`generate-ai-suggestion`** (по запросу)
- Генерирует советы для событий
- Rate limiting: 20 запросов/минуту

---

## 📊 МОНИТОРИНГ

### AI Monitoring Dashboard
Перейдите на **`/ai-monitoring`** для просмотра:
- ✅ Статистика AI операций (последние 7 дней)
- ✅ Критические ошибки
- ✅ Средние время выполнения
- ✅ Success rate
- ✅ Разбивка по типам операций

### SQL запросы для мониторинга

**Последние retry попытки:**
```sql
SELECT * FROM ai_retry_logs 
ORDER BY created_at DESC LIMIT 50;
```

**Метрики за последние 24 часа:**
```sql
SELECT operation_type, 
       COUNT(*) as total,
       AVG(execution_time_ms) as avg_time_ms,
       COUNT(*) FILTER (WHERE status = 'success') as success_count
FROM ai_operation_metrics 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY operation_type;
```

**Критические ошибки (не resolved):**
```sql
SELECT * FROM ai_error_notifications 
WHERE severity IN ('high', 'critical') 
  AND resolved = false
ORDER BY created_at DESC;
```

**Текущие rate limits:**
```sql
SELECT user_id, endpoint, request_count, window_start 
FROM api_rate_limits 
WHERE window_start > NOW() - INTERVAL '5 minutes'
ORDER BY request_count DESC;
```

---

## 🧪 ТЕСТИРОВАНИЕ

### Тест 1: Rate Limiting
```bash
# Отправить 35 запросов подряд (лимит 30/мин)
for i in {1..35}; do
  curl -X POST https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-chat \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"message":"test","userId":"YOUR_USER_ID"}'
  echo "Request $i"
done
```
**Ожидается:** После 30 запросов - ответ 429 с заголовками rate limit

### Тест 2: Cron Job (ручной запуск)
```bash
curl -X POST https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-week-planner \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dGVmc2V4eHd0bHJvcHprbXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjIxOTEsImV4cCI6MjA3NDA5ODE5MX0.fPbLIqM08fdMuAO2vQO5mj-Zt3yBpTmmUXrwAV5fWg0"
```
**Ожидается:** Предложения в `event_move_suggestions`, сообщения в чате

### Тест 3: Microsoft Event ID
```sql
-- Проверить, что Microsoft события используют правильное поле
SELECT id, title, source, google_event_id, microsoft_event_id 
FROM events 
WHERE source = 'outlook'
LIMIT 5;
```
**Ожидается:** `microsoft_event_id` заполнен, `google_event_id` = NULL

---

## 🔧 TROUBLESHOOTING

### Проблема: Rate limit срабатывает слишком часто

**Решение 1:** Увеличить лимиты
```typescript
// supabase/functions/_shared/rate-limiter.ts
'ai-chat': { maxRequests: 50, windowMs: 60000 }
```

**Решение 2:** Очистить старые записи вручную
```sql
DELETE FROM api_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
```

### Проблема: Cron job не запускается

**Проверка 1:** Расширения включены?
```sql
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
```

**Проверка 2:** Job существует?
```sql
SELECT * FROM cron.job WHERE jobname LIKE '%planner%';
```

**Проверка 3:** Последние запуски
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ai-week-planner-daily')
ORDER BY start_time DESC LIMIT 5;
```

### Проблема: Microsoft события не синхронизируются

**Проверка:** Токены актуальны?
```sql
SELECT user_id, provider, expires_at, 
       (expires_at < NOW()) as is_expired
FROM user_tokens 
WHERE provider = 'microsoft';
```

### Проблема: AI не генерирует предложения

**Чек-лист:**
1. ✅ OpenAI API key настроен в Supabase Secrets
2. ✅ У пользователя есть данные цикла (`user_cycles`)
3. ✅ У пользователя есть события на ближайшие 7 дней
4. ✅ Проверить логи edge function
5. ✅ Проверить `ai_error_notifications`

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

1. ✅ **Включить Leaked Password Protection** (см. раздел 4)
2. 📊 **Следить за метриками** на `/ai-monitoring`
3. 🔍 **Мониторить rate limits** - возможно потребуется корректировка
4. 🔔 **Настроить уведомления** о критических ошибках (опционально)
5. 🧪 **Провести нагрузочное тестирование** rate limiting

---

## 🔗 ПОЛЕЗНЫЕ ССЫЛКИ


- [Supabase Dashboard](https://supabase.com/dashboard/project/pytefsexxwtlropzkmxi)
- [Edge Functions](https://supabase.com/dashboard/project/pytefsexxwtlropzkmxi/functions)
- [Database Cron Jobs](https://supabase.com/dashboard/project/pytefsexxwtlropzkmxi/database/cron)
- [Authentication Settings](https://supabase.com/dashboard/project/pytefsexxwtlropzkmxi/auth/providers)
- [AI Monitoring Dashboard](/ai-monitoring)
- [Supabase Cron Docs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [Microsoft Graph Docs](https://learn.microsoft.com/en-us/graph/)
- [OpenAI API Docs](https://platform.openai.com/docs)

---

## 🏁 ЧЕКЛИСТ ГОТОВНОСТИ

- [x] База данных: таблицы созданы
- [x] Event ID: разделены для Google/Microsoft
- [x] Cron Jobs: настроены и запущены
- [x] Rate Limiting: активно
- [ ] **Password Protection: ТРЕБУЕТСЯ ВКЛЮЧИТЬ ВРУЧНУЮ**
- [x] Мониторинг: dashboard доступен
- [x] Edge Functions: задеплоены

**Осталось только включить Leaked Password Protection вручную в Supabase Dashboard!**

Удачи! 🚀

