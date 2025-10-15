# Настройка AI-ассистента по переносу событий

## Обзор

AI-ассистент автоматически анализирует календарь пользователя и предлагает переносить события, учитывая:
- Фазу менструального цикла
- Плотность расписания
- Недавние логи самочувствия

## 📋 Компоненты системы

### 1. База данных
✅ **Таблица `event_move_suggestions`** - хранит предложения AI по переносу
- Создана автоматически через миграцию
- Включает RLS политики для безопасности

### 2. Edge Functions

#### `ai-week-planner` 
- **Назначение**: Анализирует календарь на неделю вперед
- **Запуск**: Через cron (ежедневно)
- **Что делает**:
  - Проверяет события всех пользователей
  - Находит дни с перегрузкой
  - Создает предложения по переносу
  - Добавляет сообщения в чат

#### `ai-handle-event-move`
- **Назначение**: Отправляет письма участникам
- **Запуск**: По запросу пользователя (кнопка в чате)
- **Что делает**:
  - Получает участников события
  - Отправляет письмо через Gmail/Outlook API
  - Обновляет статус предложения

#### `ai-handle-email-reply`
- **Назначение**: Обрабатывает ответы участников
- **Запуск**: Через webhook от Gmail/Outlook
- **Что делает**:
  - Анализирует ответ с помощью AI
  - Обновляет событие при согласии
  - Уведомляет пользователя в чате

### 3. UI (Chat.tsx)
- Отображает предложения AI в виде карточек
- Кнопка "Написать участникам" → вызывает `ai-handle-event-move`
- Real-time обновления через Supabase subscriptions

---

## 🚀 Инструкция по запуску

### Шаг 1: Настроить Cron Job

Выполните SQL в Supabase SQL Editor:

\`\`\`sql
-- 1. Включить расширения pg_cron и pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Создать cron job для ежедневного запуска (каждое утро в 9:00 UTC)
SELECT cron.schedule(
  'ai-week-planner-daily',
  '0 9 * * *', -- каждый день в 9:00 UTC (12:00 MSK)
  $$
  SELECT
    net.http_post(
      url:='https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-week-planner',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
\`\`\`

**Важно**: Замените `YOUR_SERVICE_ROLE_KEY` на ваш Service Role Key из Supabase Dashboard → Settings → API.

### Шаг 2: Проверить работу Cron

Чтобы проверить, запустить функцию вручную:

\`\`\`bash
curl -X POST https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-week-planner \\
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json"
\`\`\`

Проверьте логи в Supabase Dashboard → Edge Functions → ai-week-planner → Logs.

### Шаг 3: Настроить Gmail Webhook (для получения ответов)

#### 3.1 Создать Google Cloud Pub/Sub Topic

1. Перейти в [Google Cloud Console](https://console.cloud.google.com/cloudpubsub)
2. Создать новый Topic: `gmail-notifications`
3. Скопировать полное имя топика (например, `projects/YOUR_PROJECT/topics/gmail-notifications`)

#### 3.2 Настроить Gmail Push Notifications

Выполните через Gmail API:

\`\`\`javascript
// Пример запроса для настройки webhook
POST https://gmail.googleapis.com/gmail/v1/users/me/watch
{
  "labelIds": ["INBOX"],
  "topicName": "projects/YOUR_PROJECT/topics/gmail-notifications"
}
\`\`\`

#### 3.3 Создать Cloud Function для обработки Pub/Sub

\`\`\`javascript
// Google Cloud Function
exports.handleGmailWebhook = async (message, context) => {
  const data = Buffer.from(message.data, 'base64').toString();
  const historyId = JSON.parse(data).historyId;
  
  // Получить новые сообщения из истории
  // Вызвать ai-handle-email-reply через fetch
  
  await fetch('https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-handle-email-reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY'
    },
    body: JSON.stringify({
      threadId: extractedThreadId,
      emailBody: extractedBody,
      userId: extractedUserId
    })
  });
};
\`\`\`

### Шаг 4: Настроить Outlook Webhook

1. Зарегистрировать webhook endpoint в Azure AD
2. Подписаться на уведомления о новых письмах через Microsoft Graph API:

\`\`\`javascript
POST https://graph.microsoft.com/v1.0/subscriptions
{
  "changeType": "created",
  "notificationUrl": "https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-handle-email-reply",
  "resource": "/me/mailFolders('Inbox')/messages",
  "expirationDateTime": "2025-12-31T00:00:00Z",
  "clientState": "secretClientValue"
}
\`\`\`

---

## 🧪 Тестирование

### Тест 1: Ручной запуск ai-week-planner

\`\`\`bash
curl -X POST https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-week-planner \\
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
\`\`\`

Ожидаемый результат:
- В логах Edge Function появятся записи о созданных предложениях
- В таблице `event_move_suggestions` появятся новые записи
- В чате пользователя появятся сообщения от AI

### Тест 2: Перенос события

1. Открыть чат в приложении
2. Увидеть карточку с предложением переноса
3. Нажать "Написать участникам"
4. Проверить, что письмо отправлено (статус в БД = 'email_sent')

### Тест 3: Обработка ответа

Симулировать webhook:

\`\`\`bash
curl -X POST https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-handle-email-reply \\
  -H "Content-Type: application/json" \\
  -d '{
    "threadId": "test-thread-123",
    "emailBody": "Да, давайте перенесем на это время",
    "userId": "user-uuid-here"
  }'
\`\`\`

---

## 📊 Мониторинг

### Проверить статус Cron Job

\`\`\`sql
SELECT * FROM cron.job WHERE jobname = 'ai-week-planner-daily';
\`\`\`

### Посмотреть последние запуски

\`\`\`sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ai-week-planner-daily')
ORDER BY start_time DESC
LIMIT 10;
\`\`\`

### Посмотреть логи Edge Functions

Supabase Dashboard → Edge Functions → [function name] → Logs

---

## 🔧 Настройка

### Изменить время запуска Cron

\`\`\`sql
-- Запускать каждый день в 8:00 UTC (11:00 MSK)
SELECT cron.schedule(
  'ai-week-planner-daily',
  '0 8 * * *',
  ...
);
\`\`\`

### Отключить Cron

\`\`\`sql
SELECT cron.unschedule('ai-week-planner-daily');
\`\`\`

---

## 🐛 Troubleshooting

### Предложения не создаются

1. Проверить, что у пользователей есть:
   - Записи в `user_cycles`
   - События на ближайшие 7 дней в `events`
2. Проверить логи `ai-week-planner`
3. Проверить, что OPENAI_API_KEY настроен в Supabase Secrets

### Письма не отправляются

1. Проверить токены в `user_tokens` (provider = 'google' или 'microsoft')
2. Проверить, что у событий есть участники
3. Проверить логи `ai-handle-event-move`

### Ответы не обрабатываются

1. Проверить, что webhook корректно настроен в Gmail/Outlook
2. Проверить, что `email_thread_id` записан в `event_move_suggestions`
3. Проверить логи `ai-handle-email-reply`

---

## 📚 Полезные ссылки

- [Supabase Cron Jobs](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Gmail Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Microsoft Graph Webhooks](https://learn.microsoft.com/en-us/graph/webhooks)
- [OpenAI API](https://platform.openai.com/docs/api-reference)

---

## 🎯 Следующие шаги

1. ✅ Настроить Cron Job (Шаг 1)
2. ✅ Протестировать ручной запуск (Тест 1)
3. ⏳ Настроить Gmail/Outlook Webhooks (Шаг 3-4)
4. ⏳ Протестировать полный цикл (Тесты 2-3)

Удачи! 🚀
