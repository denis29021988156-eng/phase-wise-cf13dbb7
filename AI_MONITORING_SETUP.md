# Инструкция по настройке мониторинга AI-ассистента

## ✅ Реализованные компоненты

### 1. Таблицы для мониторинга

- **ai_retry_logs** - логи повторных попыток операций
- **ai_operation_metrics** - метрики производительности
- **ai_error_notifications** - критические уведомления

### 2. Edge Functions

- **get-ai-stats** - получение статистики работы AI
- Все существующие функции обновлены с логированием

### 3. UI Дашборд

- Страница `/ai-monitoring` с визуализацией метрик
- Графики успешности операций
- Список критических ошибок

## 🔧 Настройка Cron Job для ai-week-planner

Выполните SQL команду в Supabase SQL Editor:

```sql
-- Включить расширения
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Создать Cron Job (каждый день в 9:00 UTC)
SELECT cron.schedule(
  'daily-ai-planner',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url:='https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-week-planner',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dGVmc2V4eHd0bHJvcHprbXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjIxOTEsImV4cCI6MjA3NDA5ODE5MX0.fPbLIqM08fdMuAO2vQO5mj-Zt3yBpTmmUXrwAV5fWg0"}'::jsonb
  );
  $$
);

-- Проверить созданные задачи
SELECT * FROM cron.job;

-- Посмотреть историю выполнений
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Изменить расписание

```sql
-- Обновить расписание (например, на 10:00)
SELECT cron.schedule(
  'daily-ai-planner',
  '0 10 * * *',
  $$ ... $$
);

-- Удалить задачу
SELECT cron.unschedule('daily-ai-planner');
```

## 🔄 Автоматическая очистка старых логов

Создайте еще один Cron Job для очистки:

```sql
-- Каждую неделю в воскресенье в 3:00 UTC
SELECT cron.schedule(
  'weekly-cleanup-logs',
  '0 3 * * 0',
  $$
  SELECT cleanup_old_ai_logs();
  $$
);
```

## 📊 Использование дашборда

### Просмотр статистики

1. Откройте `/ai-monitoring` в приложении
2. Выберите период (7, 30, 90 дней)
3. Просмотрите:
   - Общее количество предложений
   - Success rate операций
   - Среднее время выполнения
   - Критические ошибки

### Получение статистики через API

```typescript
const { data } = await supabase.functions.invoke('get-ai-stats', {
  body: { days: 7 }
});

console.log(data.stats);
// {
//   total_suggestions: 42,
//   accepted_suggestions: 28,
//   rejected_suggestions: 10,
//   emails_sent: 25,
//   success_rate: 92.5,
//   avg_execution_time_ms: 1250,
//   critical_errors: 2
// }
```

## 🔔 Уведомления о критических ошибках

Критические ошибки (severity: 'critical' или 'high') автоматически отправляются в чат пользователю.

### Пример обработки

```sql
-- Посмотреть все необработанные критические ошибки
SELECT * FROM ai_error_notifications 
WHERE resolved = false 
AND severity IN ('critical', 'high')
ORDER BY created_at DESC;

-- Пометить как решенное
UPDATE ai_error_notifications 
SET resolved = true, resolved_at = NOW() 
WHERE id = '<error_id>';
```

## ⏱️ Таймауты

Все операции имеют таймауты:
- AI-анализ: 30 секунд
- Отправка email: 45 секунд
- Webhook обработка: 60 секунд

## 🧪 Тестовые сценарии

### 1. Симуляция отказа API

```typescript
// В коде edge function добавьте:
if (Math.random() < 0.3) {
  throw new Error('Simulated API failure');
}
```

### 2. Проверка retry логики

Посмотрите `ai_retry_logs`:
```sql
SELECT * FROM ai_retry_logs 
WHERE operation_type = 'email_send'
ORDER BY created_at DESC;
```

### 3. Ручной запуск ai-week-planner

```bash
curl -X POST \
  https://pytefsexxwtlropzkmxi.supabase.co/functions/v1/ai-week-planner \
  -H "Authorization: Bearer YOUR_KEY"
```

## 📈 Метрики производительности

### Анализ узких мест

```sql
-- Самые медленные операции
SELECT 
  operation_type,
  AVG(execution_time_ms) as avg_time,
  MAX(execution_time_ms) as max_time,
  COUNT(*) as count
FROM ai_operation_metrics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY operation_type
ORDER BY avg_time DESC;

-- Операции с высоким процентом ошибок
SELECT 
  operation_type,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status = 'error')::NUMERIC / COUNT(*) * 100, 2) as error_rate
FROM ai_operation_metrics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY operation_type
HAVING COUNT(*) FILTER (WHERE status = 'error') > 0
ORDER BY error_rate DESC;
```

## 🔍 Отладка

### Проверка логов Edge Functions

1. Перейдите в Supabase Dashboard
2. Functions → Выберите функцию → Logs
3. Фильтруйте по ошибкам

### Проверка webhook'ов (Gmail/Outlook)

```sql
-- Посмотреть события с отправленными письмами, но без ответов
SELECT ems.*, e.title 
FROM event_move_suggestions ems
JOIN events e ON e.id = ems.event_id
WHERE ems.status = 'email_sent'
AND ems.email_sent_at < NOW() - INTERVAL '24 hours'
ORDER BY ems.email_sent_at DESC;
```

## 🚨 Алерты

Рекомендуется настроить алерты на:
- `critical_errors > 0` за последние 24 часа
- `success_rate < 80%` за последние 7 дней
- `avg_execution_time_ms > 5000` (слишком медленно)

## 📝 Best Practices

1. **Регулярно проверяйте дашборд** (раз в неделю)
2. **Отмечайте ошибки как resolved** после исправления
3. **Анализируйте retry logs** при частых сбоях
4. **Мониторьте execution time** для выявления деградации
5. **Очищайте старые логи** автоматически
