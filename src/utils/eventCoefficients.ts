export interface EventCoefficientData {
  category: string;
  eventType: string;
  base: number;
  menstrual: number;
  follicular: number;
  ovulation: number;
  luteal: number;
  morning: number;
  afternoon: number;
  evening: number;
  stressCoefficient: number;
}

export const EVENT_COEFFICIENTS: EventCoefficientData[] = [
  // РАБОТА
  { category: "РАБОТА", eventType: "Фокус-работа (2-4ч)", base: -0.30, menstrual: -0.50, follicular: -0.10, ovulation: 0.00, luteal: -0.40, morning: -0.40, afternoon: -0.20, evening: -0.60, stressCoefficient: 0.20 },
  { category: "РАБОТА", eventType: "Совещание (30-60м)", base: -0.40, menstrual: -0.70, follicular: -0.20, ovulation: -0.10, luteal: -0.50, morning: -0.60, afternoon: -0.30, evening: -0.50, stressCoefficient: 0.60 },
  { category: "РАБОТА", eventType: "Презентация", base: -0.60, menstrual: -1.00, follicular: -0.30, ovulation: -0.10, luteal: -0.70, morning: -0.70, afternoon: -0.50, evening: -0.80, stressCoefficient: 0.80 },
  { category: "РАБОТА", eventType: "Письма/Email", base: -0.15, menstrual: -0.30, follicular: -0.05, ovulation: 0.00, luteal: -0.20, morning: -0.20, afternoon: -0.10, evening: -0.30, stressCoefficient: 0.15 },
  { category: "РАБОТА", eventType: "Звонок/видеокол", base: -0.25, menstrual: -0.50, follicular: -0.10, ovulation: -0.05, luteal: -0.35, morning: -0.40, afternoon: -0.20, evening: -0.40, stressCoefficient: 0.40 },
  { category: "РАБОТА", eventType: "Конфликт с коллегой", base: -0.80, menstrual: -1.00, follicular: -0.60, ovulation: -0.40, luteal: -0.90, morning: -0.70, afternoon: -0.70, evening: -0.90, stressCoefficient: 1.00 },
  { category: "РАБОТА", eventType: "Дедлайн/спешка", base: -0.70, menstrual: -1.00, follicular: -0.50, ovulation: -0.30, luteal: -0.80, morning: -0.80, afternoon: -0.70, evening: -0.80, stressCoefficient: 0.90 },

  // СЕМЬЯ
  { category: "СЕМЬЯ", eventType: "Ужин с семьёй", base: -0.15, menstrual: -0.30, follicular: 0.10, ovulation: 0.20, luteal: -0.20, morning: 0.00, afternoon: 0.00, evening: -0.30, stressCoefficient: 0.10 },
  { category: "СЕМЬЯ", eventType: "Помощь ребёнку", base: -0.30, menstrual: -0.50, follicular: -0.10, ovulation: -0.05, luteal: -0.40, morning: -0.20, afternoon: -0.40, evening: -0.30, stressCoefficient: 0.25 },
  { category: "СЕМЬЯ", eventType: "Ссора с партнёром", base: -0.70, menstrual: -1.00, follicular: -0.50, ovulation: -0.30, luteal: -0.80, morning: -0.60, afternoon: -0.70, evening: -0.80, stressCoefficient: 0.95 },
  { category: "СЕМЬЯ", eventType: "Разговор с родителями", base: -0.40, menstrual: -0.60, follicular: -0.20, ovulation: -0.10, luteal: -0.50, morning: -0.40, afternoon: -0.30, evening: -0.50, stressCoefficient: 0.50 },
  { category: "СЕМЬЯ", eventType: "День рождения/праздник", base: -0.20, menstrual: -0.40, follicular: 0.20, ovulation: 0.30, luteal: -0.25, morning: -0.10, afternoon: 0.00, evening: -0.35, stressCoefficient: 0.15 },

  // БЫТ
  { category: "БЫТ", eventType: "Уборка (30-60м)", base: -0.25, menstrual: -0.50, follicular: -0.05, ovulation: 0.10, luteal: -0.30, morning: -0.20, afternoon: -0.20, evening: -0.40, stressCoefficient: 0.20 },
  { category: "БЫТ", eventType: "Магазин (30-40м)", base: -0.20, menstrual: -0.40, follicular: 0.00, ovulation: 0.10, luteal: -0.25, morning: -0.10, afternoon: -0.20, evening: -0.30, stressCoefficient: 0.15 },
  { category: "БЫТ", eventType: "Стирка/готовка", base: -0.15, menstrual: -0.30, follicular: -0.05, ovulation: 0.00, luteal: -0.20, morning: -0.10, afternoon: -0.15, evening: -0.20, stressCoefficient: 0.10 },
  { category: "БЫТ", eventType: "Готовка (1-2ч)", base: -0.20, menstrual: -0.40, follicular: -0.05, ovulation: 0.05, luteal: -0.25, morning: -0.15, afternoon: -0.20, evening: -0.30, stressCoefficient: 0.15 },
  { category: "БЫТ", eventType: "Кухня/посуда", base: -0.10, menstrual: -0.20, follicular: 0.00, ovulation: 0.05, luteal: -0.15, morning: -0.05, afternoon: -0.10, evening: -0.15, stressCoefficient: 0.08 },
  { category: "БЫТ", eventType: "Стирка", base: -0.12, menstrual: -0.25, follicular: 0.00, ovulation: 0.05, luteal: -0.15, morning: -0.10, afternoon: -0.10, evening: -0.15, stressCoefficient: 0.10 },
  { category: "БЫТ", eventType: "Финансы/бумаги", base: -0.35, menstrual: -0.60, follicular: -0.15, ovulation: -0.05, luteal: -0.45, morning: -0.35, afternoon: -0.30, evening: -0.45, stressCoefficient: 0.70 },
  { category: "БЫТ", eventType: "Ремонт/сантехник", base: -0.40, menstrual: -0.70, follicular: -0.20, ovulation: -0.10, luteal: -0.50, morning: -0.40, afternoon: -0.35, evening: -0.50, stressCoefficient: 0.75 },
  { category: "БЫТ", eventType: "Автомобиль/техника", base: -0.30, menstrual: -0.55, follicular: -0.10, ovulation: 0.00, luteal: -0.40, morning: -0.25, afternoon: -0.25, evening: -0.40, stressCoefficient: 0.60 },

  // СОЦИУМ
  { category: "СОЦИУМ", eventType: "Вечеринка/мероприятие", base: -0.35, menstrual: -0.60, follicular: 0.10, ovulation: 0.30, luteal: -0.40, morning: -0.20, afternoon: -0.20, evening: -0.50, stressCoefficient: 0.30 },
  { category: "СОЦИУМ", eventType: "Встреча с друзьями", base: -0.20, menstrual: -0.40, follicular: 0.10, ovulation: 0.20, luteal: -0.25, morning: -0.10, afternoon: -0.15, evening: -0.30, stressCoefficient: 0.15 },
  { category: "СОЦИУМ", eventType: "Сетевое мероприятие", base: -0.50, menstrual: -0.80, follicular: -0.20, ovulation: 0.10, luteal: -0.60, morning: -0.50, afternoon: -0.40, evening: -0.65, stressCoefficient: 0.75 },
  { category: "СОЦИУМ", eventType: "Встреча 1-на-1", base: -0.25, menstrual: -0.45, follicular: -0.05, ovulation: 0.10, luteal: -0.35, morning: -0.20, afternoon: -0.15, evening: -0.40, stressCoefficient: 0.35 },
  { category: "СОЦИУМ", eventType: "Консультация/совет", base: -0.30, menstrual: -0.50, follicular: -0.10, ovulation: 0.05, luteal: -0.40, morning: -0.30, afternoon: -0.25, evening: -0.45, stressCoefficient: 0.50 },
  { category: "СОЦИУМ", eventType: "Комплимент/похвала", base: 0.15, menstrual: 0.10, follicular: 0.20, ovulation: 0.30, luteal: 0.10, morning: 0.15, afternoon: 0.20, evening: 0.10, stressCoefficient: -0.30 },

  // СПОРТ
  { category: "СПОРТ", eventType: "Тренировка (60м)", base: -0.20, menstrual: -0.60, follicular: 0.20, ovulation: 0.40, luteal: -0.30, morning: -0.10, afternoon: 0.10, evening: -0.30, stressCoefficient: 0.15 },
  { category: "СПОРТ", eventType: "Йога (мягкая, 30м)", base: 0.20, menstrual: 0.40, follicular: 0.10, ovulation: 0.00, luteal: 0.30, morning: 0.30, afternoon: 0.20, evening: 0.10, stressCoefficient: -0.40 },
  { category: "СПОРТ", eventType: "Йога (интенсивная)", base: -0.15, menstrual: -0.40, follicular: 0.15, ovulation: 0.35, luteal: -0.25, morning: -0.05, afternoon: 0.10, evening: -0.25, stressCoefficient: 0.10 },
  { category: "СПОРТ", eventType: "Кардио/HIIT", base: -0.40, menstrual: -0.80, follicular: 0.30, ovulation: 0.50, luteal: -0.50, morning: -0.30, afternoon: 0.10, evening: -0.50, stressCoefficient: 0.25 },
  { category: "СПОРТ", eventType: "Силовая тренировка", base: -0.25, menstrual: -0.60, follicular: 0.15, ovulation: 0.35, luteal: -0.35, morning: -0.15, afternoon: 0.05, evening: -0.35, stressCoefficient: 0.20 },
  { category: "СПОРТ", eventType: "Прогулка быстрая", base: 0.20, menstrual: 0.00, follicular: 0.40, ovulation: 0.50, luteal: 0.15, morning: 0.30, afternoon: 0.25, evening: 0.10, stressCoefficient: -0.25 },
  { category: "СПОРТ", eventType: "Пилатес", base: 0.15, menstrual: 0.20, follicular: 0.10, ovulation: 0.10, luteal: 0.20, morning: 0.20, afternoon: 0.15, evening: 0.10, stressCoefficient: -0.35 },
  { category: "СПОРТ", eventType: "Растяжка", base: 0.25, menstrual: 0.35, follicular: 0.20, ovulation: 0.15, luteal: 0.30, morning: 0.30, afternoon: 0.25, evening: 0.20, stressCoefficient: -0.50 },
  { category: "СПОРТ", eventType: "Танцы/зумба", base: -0.10, menstrual: -0.40, follicular: 0.25, ovulation: 0.45, luteal: -0.20, morning: 0.00, afternoon: 0.15, evening: -0.20, stressCoefficient: 0.05 },

  // ВОССТАНОВЛЕНИЕ
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Сон (7-8ч)", base: 0.80, menstrual: 1.00, follicular: 0.60, ovulation: 0.40, luteal: 0.90, morning: 0.00, afternoon: 0.30, evening: 1.00, stressCoefficient: -1.00 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Прогулка (20-30м)", base: 0.40, menstrual: 0.20, follicular: 0.60, ovulation: 0.70, luteal: 0.30, morning: 0.50, afternoon: 0.40, evening: 0.20, stressCoefficient: -0.35 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Медитация (20м)", base: 0.50, menstrual: 0.70, follicular: 0.40, ovulation: 0.30, luteal: 0.60, morning: 0.60, afternoon: 0.50, evening: 0.40, stressCoefficient: -0.70 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Массаж/СПА", base: 0.60, menstrual: 0.90, follicular: 0.30, ovulation: 0.20, luteal: 0.70, morning: 0.40, afternoon: 0.70, evening: 0.60, stressCoefficient: -0.80 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Ванна горячая", base: 0.55, menstrual: 0.85, follicular: 0.35, ovulation: 0.25, luteal: 0.65, morning: 0.20, afternoon: 0.40, evening: 0.75, stressCoefficient: -0.75 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Читать/хобби", base: 0.35, menstrual: 0.50, follicular: 0.25, ovulation: 0.15, luteal: 0.45, morning: 0.20, afternoon: 0.35, evening: 0.45, stressCoefficient: -0.50 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Фильм/сериал", base: 0.30, menstrual: 0.45, follicular: 0.20, ovulation: 0.10, luteal: 0.40, morning: 0.10, afternoon: 0.25, evening: 0.40, stressCoefficient: -0.45 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Творчество/рисование", base: 0.40, menstrual: 0.55, follicular: 0.30, ovulation: 0.20, luteal: 0.50, morning: 0.35, afternoon: 0.40, evening: 0.45, stressCoefficient: -0.55 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Музыка/пение", base: 0.45, menstrual: 0.65, follicular: 0.35, ovulation: 0.25, luteal: 0.55, morning: 0.40, afternoon: 0.45, evening: 0.50, stressCoefficient: -0.60 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Природа/лес", base: 0.50, menstrual: 0.70, follicular: 0.40, ovulation: 0.30, luteal: 0.60, morning: 0.55, afternoon: 0.50, evening: 0.45, stressCoefficient: -0.65 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Объятия/связь", base: 0.35, menstrual: 0.50, follicular: 0.25, ovulation: 0.15, luteal: 0.45, morning: 0.30, afternoon: 0.35, evening: 0.40, stressCoefficient: -0.55 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Секс", base: 0.25, menstrual: 0.10, follicular: 0.40, ovulation: 0.50, luteal: 0.20, morning: 0.15, afternoon: 0.30, evening: 0.25, stressCoefficient: -0.70 },
  { category: "ВОССТАНОВЛЕНИЕ", eventType: "Интимность", base: 0.30, menstrual: 0.20, follicular: 0.35, ovulation: 0.45, luteal: 0.25, morning: 0.25, afternoon: 0.30, evening: 0.35, stressCoefficient: -0.65 },

  // ЗДОРОВЬЕ
  { category: "ЗДОРОВЬЕ", eventType: "Приём врача", base: -0.45, menstrual: -0.70, follicular: -0.25, ovulation: -0.15, luteal: -0.55, morning: -0.40, afternoon: -0.50, evening: -0.50, stressCoefficient: 0.85 },
  { category: "ЗДОРОВЬЕ", eventType: "Анализы/тесты", base: -0.40, menstrual: -0.65, follicular: -0.20, ovulation: -0.10, luteal: -0.50, morning: -0.35, afternoon: -0.45, evening: -0.45, stressCoefficient: 0.80 },
  { category: "ЗДОРОВЬЕ", eventType: "Стоматолог", base: -0.50, menstrual: -0.80, follicular: -0.30, ovulation: -0.20, luteal: -0.60, morning: -0.50, afternoon: -0.55, evening: -0.55, stressCoefficient: 0.95 },
  { category: "ЗДОРОВЬЕ", eventType: "Физиотерапия", base: -0.30, menstrual: -0.50, follicular: -0.10, ovulation: 0.00, luteal: -0.40, morning: -0.25, afternoon: -0.30, evening: -0.35, stressCoefficient: 0.60 },
  { category: "ЗДОРОВЬЕ", eventType: "Принять лекарство", base: -0.10, menstrual: -0.20, follicular: 0.00, ovulation: 0.05, luteal: -0.15, morning: -0.10, afternoon: -0.10, evening: -0.10, stressCoefficient: 0.30 },
  { category: "ЗДОРОВЬЕ", eventType: "Витамины", base: 0.10, menstrual: 0.15, follicular: 0.10, ovulation: 0.05, luteal: 0.15, morning: 0.10, afternoon: 0.10, evening: 0.10, stressCoefficient: -0.20 },

  // ЗНАНИЯ
  { category: "ЗНАНИЯ", eventType: "Учёба/курс", base: -0.35, menstrual: -0.55, follicular: -0.15, ovulation: -0.05, luteal: -0.45, morning: -0.35, afternoon: -0.30, evening: -0.45, stressCoefficient: 0.50 },
  { category: "ЗНАНИЯ", eventType: "Вебинар", base: -0.30, menstrual: -0.50, follicular: -0.10, ovulation: 0.00, luteal: -0.40, morning: -0.30, afternoon: -0.25, evening: -0.40, stressCoefficient: 0.45 },
  { category: "ЗНАНИЯ", eventType: "Чтение (деловое)", base: -0.20, menstrual: -0.40, follicular: 0.00, ovulation: 0.10, luteal: -0.30, morning: -0.20, afternoon: -0.15, evening: -0.30, stressCoefficient: 0.30 },
  { category: "ЗНАНИЯ", eventType: "Подкаст/аудиокн", base: 0.15, menstrual: 0.00, follicular: 0.25, ovulation: 0.35, luteal: 0.10, morning: 0.20, afternoon: 0.20, evening: 0.10, stressCoefficient: -0.25 },

  // ЭМОЦИИ
  { category: "ЭМОЦИИ", eventType: "Конфликт/ссора", base: -0.85, menstrual: -1.00, follicular: -0.70, ovulation: -0.50, luteal: -0.95, morning: -0.80, afternoon: -0.85, evening: -0.95, stressCoefficient: 1.00 },
  { category: "ЭМОЦИИ", eventType: "Критика/отказ", base: -0.70, menstrual: -1.00, follicular: -0.50, ovulation: -0.30, luteal: -0.80, morning: -0.70, afternoon: -0.70, evening: -0.80, stressCoefficient: 0.95 },
  { category: "ЭМОЦИИ", eventType: "Успех/достижение", base: 0.60, menstrual: 0.40, follicular: 0.70, ovulation: 0.80, luteal: 0.50, morning: 0.60, afternoon: 0.65, evening: 0.55, stressCoefficient: -0.80 },
  { category: "ЭМОЦИИ", eventType: "Вдохновение", base: 0.55, menstrual: 0.35, follicular: 0.65, ovulation: 0.75, luteal: 0.45, morning: 0.55, afternoon: 0.60, evening: 0.50, stressCoefficient: -0.75 },
  { category: "ЭМОЦИИ", eventType: "Печаль/горе", base: -0.60, menstrual: -0.90, follicular: -0.40, ovulation: -0.20, luteal: -0.70, morning: -0.60, afternoon: -0.60, evening: -0.70, stressCoefficient: 0.90 },
  { category: "ЭМОЦИИ", eventType: "Тревога/паника", base: -0.75, menstrual: -1.00, follicular: -0.55, ovulation: -0.35, luteal: -0.85, morning: -0.75, afternoon: -0.75, evening: -0.85, stressCoefficient: 1.00 },
  { category: "ЭМОЦИИ", eventType: "Благодарность", base: 0.50, menstrual: 0.35, follicular: 0.60, ovulation: 0.70, luteal: 0.40, morning: 0.50, afternoon: 0.55, evening: 0.45, stressCoefficient: -0.70 },

  // ПИТАНИЕ
  { category: "ПИТАНИЕ", eventType: "Завтрак питательный", base: 0.20, menstrual: 0.30, follicular: 0.15, ovulation: 0.10, luteal: 0.25, morning: 0.25, afternoon: 0.00, evening: 0.00, stressCoefficient: -0.30 },
  { category: "ПИТАНИЕ", eventType: "Обед полезный", base: 0.25, menstrual: 0.35, follicular: 0.20, ovulation: 0.15, luteal: 0.30, morning: 0.00, afternoon: 0.30, evening: 0.00, stressCoefficient: -0.35 },
  { category: "ПИТАНИЕ", eventType: "Ужин лёгкий", base: 0.15, menstrual: 0.25, follicular: 0.10, ovulation: 0.05, luteal: 0.20, morning: 0.00, afternoon: 0.00, evening: 0.20, stressCoefficient: -0.25 },
  { category: "ПИТАНИЕ", eventType: "Сладкое/конфеты", base: -0.05, menstrual: -0.15, follicular: 0.10, ovulation: 0.15, luteal: -0.10, morning: -0.05, afternoon: 0.05, evening: -0.10, stressCoefficient: 0.15 },
  { category: "ПИТАНИЕ", eventType: "Кофе/кофеин", base: -0.15, menstrual: -0.30, follicular: 0.00, ovulation: 0.10, luteal: -0.20, morning: -0.20, afternoon: -0.10, evening: -0.25, stressCoefficient: 0.35 },
  { category: "ПИТАНИЕ", eventType: "Алкоголь", base: -0.25, menstrual: -0.40, follicular: -0.10, ovulation: 0.00, luteal: -0.30, morning: -0.30, afternoon: 0.00, evening: -0.35, stressCoefficient: 0.50 },
  { category: "ПИТАНИЕ", eventType: "Вода (гидратация)", base: 0.15, menstrual: 0.25, follicular: 0.10, ovulation: 0.05, luteal: 0.20, morning: 0.15, afternoon: 0.15, evening: 0.15, stressCoefficient: -0.20 },

  // ГИГИЕНА
  { category: "ГИГИЕНА", eventType: "Душ холодный", base: 0.30, menstrual: 0.10, follicular: 0.45, ovulation: 0.50, luteal: 0.20, morning: 0.40, afternoon: 0.30, evening: 0.20, stressCoefficient: -0.40 },
  { category: "ГИГИЕНА", eventType: "Душ горячий", base: 0.25, menstrual: 0.40, follicular: 0.15, ovulation: 0.05, luteal: 0.35, morning: 0.10, afternoon: 0.20, evening: 0.35, stressCoefficient: -0.35 },
  { category: "ГИГИЕНА", eventType: "Макияж", base: 0.10, menstrual: 0.00, follicular: 0.15, ovulation: 0.20, luteal: 0.05, morning: 0.15, afternoon: 0.10, evening: 0.00, stressCoefficient: -0.15 },
  { category: "ГИГИЕНА", eventType: "Прическа/волосы", base: 0.15, menstrual: 0.05, follicular: 0.20, ovulation: 0.25, luteal: 0.10, morning: 0.20, afternoon: 0.15, evening: 0.05, stressCoefficient: -0.20 },
  { category: "ГИГИЕНА", eventType: "Уход за кожей", base: 0.20, menstrual: 0.30, follicular: 0.15, ovulation: 0.10, luteal: 0.25, morning: 0.15, afternoon: 0.10, evening: 0.25, stressCoefficient: -0.25 },
];
