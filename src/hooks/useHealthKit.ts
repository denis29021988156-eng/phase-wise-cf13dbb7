import { useState } from 'react';
import { Capacitor } from '@capacitor/core';

export interface HealthData {
  sleepQuality?: number;
  stressLevel?: number;
  energy?: number;
}

export const useHealthKit = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  // Проверка доступности HealthKit (только на iOS)
  const checkAvailability = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      setIsAvailable(false);
      return false;
    }

    try {
      const { default: HealthKit } = await import('@perfood/capacitor-healthkit');
      // @ts-ignore - плагин имеет проблемы с типами
      const result = await HealthKit.isHealthDataAvailable();
      setIsAvailable(result?.isAvailable || false);
      return result?.isAvailable || false;
    } catch (error) {
      console.error('HealthKit not available:', error);
      setIsAvailable(false);
      return false;
    }
  };

  // Запрос разрешений на чтение и запись данных
  const requestAuthorization = async () => {
    try {
      const { default: HealthKit } = await import('@perfood/capacitor-healthkit');
      
      // @ts-ignore - плагин имеет проблемы с типами
      await HealthKit.requestAuthorization({
        all: [],
        read: ['sleepAnalysis', 'heartRateVariabilitySDNN', 'restingHeartRate'],
        write: [],
      });
      
      setHasPermissions(true);
      return true;
    } catch (error) {
      console.error('Authorization failed:', error);
      return false;
    }
  };

  // Чтение данных о сне за сегодня
  const readSleepData = async (): Promise<number | null> => {
    try {
      const { default: HealthKit } = await import('@perfood/capacitor-healthkit');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      // @ts-ignore - плагин имеет проблемы с типами
      const result = await HealthKit.querySampleType({
        sampleName: 'sleepAnalysis',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 0,
      });

      if (result.resultData && result.resultData.length > 0) {
        let totalSleepMinutes = 0;
        
        result.resultData.forEach((sample: any) => {
          const start = new Date(sample.startDate);
          const end = new Date(sample.endDate);
          const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
          totalSleepMinutes += minutes;
        });

        const hours = totalSleepMinutes / 60;
        
        // Конвертация в шкалу 1-5
        if (hours < 5) return 1;
        if (hours < 6) return 2;
        if (hours < 7) return 3;
        if (hours < 8) return 4;
        return 5;
      }

      return null;
    } catch (error) {
      console.error('Failed to read sleep data:', error);
      return null;
    }
  };

  // Чтение данных о стрессе (через HRV)
  const readStressData = async (): Promise<number | null> => {
    try {
      const { default: HealthKit } = await import('@perfood/capacitor-healthkit');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      // @ts-ignore - плагин имеет проблемы с типами
      const result = await HealthKit.querySampleType({
        sampleName: 'heartRateVariabilitySDNN',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 0,
      });

      if (result.resultData && result.resultData.length > 0) {
        const avgHRV = result.resultData.reduce((sum: number, sample: any) => 
          sum + (sample.quantity || 0), 0) / result.resultData.length;

        // Конвертация HRV в уровень стресса (1-5)
        if (avgHRV > 80) return 1;
        if (avgHRV > 60) return 2;
        if (avgHRV > 40) return 3;
        if (avgHRV > 20) return 4;
        return 5;
      }

      return null;
    } catch (error) {
      console.error('Failed to read stress data:', error);
      return null;
    }
  };

  // Запись wellness index
  const writeWellnessIndex = async (wellnessIndex: number) => {
    try {
      console.log('Wellness index:', wellnessIndex);
      return true;
    } catch (error) {
      console.error('Failed to write wellness index:', error);
      return false;
    }
  };

  // Получить все данные о здоровье
  const syncFromHealth = async (): Promise<HealthData> => {
    const sleepQuality = await readSleepData();
    const stressLevel = await readStressData();

    return {
      sleepQuality: sleepQuality || undefined,
      stressLevel: stressLevel || undefined,
    };
  };

  return {
    isAvailable,
    hasPermissions,
    checkAvailability,
    requestAuthorization,
    syncFromHealth,
    writeWellnessIndex,
  };
};
