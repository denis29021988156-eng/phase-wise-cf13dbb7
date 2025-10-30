import { EVENT_COEFFICIENTS, EventCoefficientData } from './eventCoefficients';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface EventCoefficientResult {
  baseCoefficient: number;
  cycleModifier: number;
  timeModifier: number;
  stressCoefficient: number;
  finalImpact: number;
}

/**
 * Calculates the energy impact coefficient for a given event type, cycle phase, and time of day
 * 
 * @param eventType - The name of the event (e.g., "Фокус-работа (2-4ч)", "Совещание (30-60м)")
 * @param cyclePhase - The menstrual cycle phase: 'menstrual', 'follicular', 'ovulation', or 'luteal'
 * @param timeOfDay - The time of day: 'morning', 'afternoon', or 'evening'
 * @returns An object containing all coefficients and the final impact value
 */
export function getEventCoefficient(
  eventType: string,
  cyclePhase: CyclePhase,
  timeOfDay: TimeOfDay
): EventCoefficientResult | null {
  // Find the event in the coefficient table
  const eventData = EVENT_COEFFICIENTS.find(
    (item) => item.eventType.toLowerCase() === eventType.toLowerCase()
  );

  // If event not found, return null
  if (!eventData) {
    console.warn(`Event type "${eventType}" not found in coefficient table`);
    return null;
  }

  // Get base coefficient
  const baseCoefficient = eventData.base;

  // Get cycle phase modifier
  const cycleModifier = eventData[cyclePhase];

  // Get time of day modifier
  const timeModifier = eventData[timeOfDay];

  // Get stress coefficient
  const stressCoefficient = eventData.stressCoefficient;

  // Calculate final impact
  // Formula: base + cycleModifier + timeModifier
  const finalImpact = baseCoefficient + cycleModifier + timeModifier;

  return {
    baseCoefficient,
    cycleModifier,
    timeModifier,
    stressCoefficient,
    finalImpact,
  };
}

/**
 * Gets all events from a specific category
 * 
 * @param category - The category name (e.g., "РАБОТА", "СЕМЬЯ", "СПОРТ")
 * @returns Array of event data for that category
 */
export function getEventsByCategory(category: string): EventCoefficientData[] {
  return EVENT_COEFFICIENTS.filter(
    (item) => item.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Gets all available event categories
 * 
 * @returns Array of unique category names
 */
export function getAllCategories(): string[] {
  const categories = new Set(EVENT_COEFFICIENTS.map((item) => item.category));
  return Array.from(categories);
}

/**
 * Gets all event types (useful for autocomplete or suggestions)
 * 
 * @returns Array of all event type names
 */
export function getAllEventTypes(): string[] {
  return EVENT_COEFFICIENTS.map((item) => item.eventType);
}

/**
 * Searches for events by partial name match
 * 
 * @param searchTerm - The search term to match against event names
 * @returns Array of matching event data
 */
export function searchEvents(searchTerm: string): EventCoefficientData[] {
  const lowerSearch = searchTerm.toLowerCase();
  return EVENT_COEFFICIENTS.filter((item) =>
    item.eventType.toLowerCase().includes(lowerSearch)
  );
}
