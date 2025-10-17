import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export interface HealthData {
  sleepQuality?: number;
  stressLevel?: number;
}

// Функция для синхронизации данных Apple Health
export const syncAppleHealthData = async (userId: string): Promise<boolean> => {
  // Проверяем, что мы на iOS
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    console.log('Apple Health not available - not on iOS');
    return false;
  }

  try {
    const { default: HealthKit } = await import('@perfood/capacitor-healthkit');
    
    // Проверяем доступность HealthKit
    // @ts-ignore
    const availabilityResult = await HealthKit.isHealthDataAvailable();
    if (!availabilityResult?.isAvailable) {
      console.log('HealthKit not available on this device');
      return false;
    }

    // Получаем данные о сне
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    let sleepQuality: number | null = null;
    let stressLevel: number | null = null;

    try {
      // @ts-ignore
      const sleepResult = await HealthKit.querySampleType({
        sampleName: 'sleepAnalysis',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 0,
      });

      if (sleepResult.resultData && sleepResult.resultData.length > 0) {
        let totalSleepMinutes = 0;
        
        sleepResult.resultData.forEach((sample: any) => {
          const start = new Date(sample.startDate);
          const end = new Date(sample.endDate);
          const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
          totalSleepMinutes += minutes;
        });

        const hours = totalSleepMinutes / 60;
        
        // Конвертация в шкалу 1-5
        if (hours < 5) sleepQuality = 1;
        else if (hours < 6) sleepQuality = 2;
        else if (hours < 7) sleepQuality = 3;
        else if (hours < 8) sleepQuality = 4;
        else sleepQuality = 5;
      }
    } catch (error) {
      console.log('Could not read sleep data:', error);
    }

    try {
      // @ts-ignore
      const hrvResult = await HealthKit.querySampleType({
        sampleName: 'heartRateVariabilitySDNN',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 0,
      });

      if (hrvResult.resultData && hrvResult.resultData.length > 0) {
        const avgHRV = hrvResult.resultData.reduce((sum: number, sample: any) => 
          sum + (sample.quantity || 0), 0) / hrvResult.resultData.length;

        // Конвертация HRV в уровень стресса (1-5)
        if (avgHRV > 80) stressLevel = 1;
        else if (avgHRV > 60) stressLevel = 2;
        else if (avgHRV > 40) stressLevel = 3;
        else if (avgHRV > 20) stressLevel = 4;
        else stressLevel = 5;
      }
    } catch (error) {
      console.log('Could not read HRV data:', error);
    }

    // Если получили хоть какие-то данные, обновляем базу
    if (sleepQuality !== null || stressLevel !== null) {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingLog } = await supabase
        .from('symptom_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      const updateData: any = {
        user_id: userId,
        date: today,
      };
      
      if (sleepQuality !== null) updateData.sleep_quality = sleepQuality;
      if (stressLevel !== null) updateData.stress_level = stressLevel;
      
      if (existingLog) {
        await supabase
          .from('symptom_logs')
          .update(updateData)
          .eq('id', existingLog.id);
      } else {
        // Создаем новую запись с минимальными данными
        updateData.energy = 3;
        updateData.wellness_index = 50;
        await supabase
          .from('symptom_logs')
          .insert(updateData);
      }
      
      console.log('Apple Health data synced successfully:', { sleepQuality, stressLevel });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error syncing Apple Health data:', error);
    return false;
  }
};
