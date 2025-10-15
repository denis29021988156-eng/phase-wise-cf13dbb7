import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface LogRetryParams {
  supabaseClient: SupabaseClient;
  userId: string;
  operationType: string;
  attemptNumber: number;
  errorMessage?: string;
  httpStatus?: number;
  metadata?: any;
}

export interface LogMetricParams {
  supabaseClient: SupabaseClient;
  operationType: string;
  status: 'success' | 'error' | 'timeout';
  executionTimeMs?: number;
  userId?: string;
  errorDetails?: string;
  metadata?: any;
}

export interface LogErrorNotificationParams {
  supabaseClient: SupabaseClient;
  errorType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  operationType?: string;
  userId?: string;
  metadata?: any;
}

export async function logRetryAttempt(params: LogRetryParams): Promise<void> {
  try {
    await params.supabaseClient
      .from('ai_retry_logs')
      .insert({
        user_id: params.userId,
        operation_type: params.operationType,
        attempt_number: params.attemptNumber,
        error_message: params.errorMessage,
        http_status: params.httpStatus,
        metadata: params.metadata,
      });
  } catch (error) {
    console.error('Failed to log retry attempt:', error);
  }
}

export async function logOperationMetric(params: LogMetricParams): Promise<void> {
  try {
    await params.supabaseClient
      .from('ai_operation_metrics')
      .insert({
        operation_type: params.operationType,
        status: params.status,
        execution_time_ms: params.executionTimeMs,
        user_id: params.userId,
        error_details: params.errorDetails,
        metadata: params.metadata,
      });
  } catch (error) {
    console.error('Failed to log operation metric:', error);
  }
}

export async function logErrorNotification(params: LogErrorNotificationParams): Promise<void> {
  try {
    await params.supabaseClient
      .from('ai_error_notifications')
      .insert({
        error_type: params.errorType,
        severity: params.severity,
        message: params.message,
        operation_type: params.operationType,
        user_id: params.userId,
        metadata: params.metadata,
      });

    // Отправить в чат если critical или high
    if (params.severity === 'critical' || params.severity === 'high') {
      if (params.userId) {
        await params.supabaseClient
          .from('chat_messages')
          .insert({
            user_id: params.userId,
            role: 'assistant',
            content: `⚠️ Системное уведомление: ${params.message}`,
          });
      }
    }
  } catch (error) {
    console.error('Failed to log error notification:', error);
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export class OperationTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }
}
