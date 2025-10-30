import { supabase } from '@/integrations/supabase/client';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface EventCoefficientResult {
  baseCoefficient: number;
  cycleModifier: number;
  timeModifier: number;
  stressCoefficient: number;
  finalImpact: number;
  isAiEstimate?: boolean;
}

/**
 * Calculates the energy impact coefficient for a given event type, cycle phase, and time of day
 * Now uses database lookup with AI fallback for unknown events
 * 
 * @param eventType - The name of the event (e.g., "Фокус-работа (2-4ч)", "Совещание (30-60м)")
 * @param cyclePhase - The menstrual cycle phase: 'menstrual', 'follicular', 'ovulation', or 'luteal'
 * @param timeOfDay - The time of day: 'morning', 'afternoon', or 'evening'
 * @param stressLevel - The stress level from 1 (low) to 5 (high), defaults to 3 (neutral)
 * @returns An object containing all coefficients and the final impact value
 */
export async function getEventCoefficient(
  eventType: string,
  cyclePhase: CyclePhase,
  timeOfDay: TimeOfDay,
  stressLevel: number = 3
): Promise<EventCoefficientResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('calculate-event-coefficient', {
      body: {
        eventType,
        cyclePhase,
        timeOfDay,
        stressLevel
      }
    });

    if (error) {
      console.error('Error calculating event coefficient:', error);
      return null;
    }

    return data as EventCoefficientResult;
  } catch (error) {
    console.error('Error calling calculate-event-coefficient function:', error);
    return null;
  }
}

/**
 * Gets all events from a specific category from the database
 * 
 * @param category - The category name (e.g., "РАБОТА", "СЕМЬЯ", "СПОРТ")
 * @returns Array of event names for that category
 */
export async function getEventsByCategory(category: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('energy_reference')
      .select('event_name')
      .eq('category', category);

    if (error) throw error;
    return data?.map(item => item.event_name) || [];
  } catch (error) {
    console.error('Error fetching events by category:', error);
    return [];
  }
}

/**
 * Gets all available event categories from the database
 * 
 * @returns Array of unique category names
 */
export async function getAllCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('energy_reference')
      .select('category')
      .order('category');

    if (error) throw error;
    
    const categories = new Set(data?.map(item => item.category) || []);
    return Array.from(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

/**
 * Gets all event types from the database (useful for autocomplete or suggestions)
 * 
 * @returns Array of all event type names
 */
export async function getAllEventTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('energy_reference')
      .select('event_name')
      .order('event_name');

    if (error) throw error;
    return data?.map(item => item.event_name) || [];
  } catch (error) {
    console.error('Error fetching event types:', error);
    return [];
  }
}

/**
 * Searches for events by partial name match in the database
 * 
 * @param searchTerm - The search term to match against event names
 * @returns Array of matching event names
 */
export async function searchEvents(searchTerm: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('energy_reference')
      .select('event_name')
      .ilike('event_name', `%${searchTerm}%`)
      .order('event_name');

    if (error) throw error;
    return data?.map(item => item.event_name) || [];
  } catch (error) {
    console.error('Error searching events:', error);
    return [];
  }
}
