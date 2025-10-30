import { cn } from "@/lib/utils";

interface MoonPhaseProps {
  value: number; // 0-100
  className?: string;
}

export const MoonPhase = ({ value, className }: MoonPhaseProps) => {
  // Определяем цвет в зависимости от значения
  const getColor = (val: number) => {
    if (val <= 30) return '#EF4444'; // red
    if (val <= 60) return '#F59E0B'; // yellow
    return '#8B5CF6'; // purple/violet
  };

  const color = getColor(value);
  const percentage = value / 100;
  const circumference = 2 * Math.PI * 85; // radius 85
  const strokeDashoffset = circumference - (percentage * circumference);

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full transform -rotate-90"
      >
        {/* Фоновое кольцо */}
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="16"
          opacity="0.2"
        />
        
        {/* Заполненное кольцо (прогресс) */}
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />
      </svg>
    </div>
  );
};
