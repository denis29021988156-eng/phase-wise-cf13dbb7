import { cn } from "@/lib/utils";

interface MoonPhaseProps {
  value: number; // 0-100
  className?: string;
}

export const MoonPhase = ({ value, className }: MoonPhaseProps) => {
  // Градация цвета: красный -> желтый -> зеленый
  const getColor = (val: number) => {
    if (val <= 30) return '#EF4444'; // red
    if (val <= 50) return '#F59E0B'; // orange
    if (val <= 70) return '#EAB308'; // yellow
    if (val <= 85) return '#84CC16'; // lime
    return '#22C55E'; // green
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
        {/* Фоновое кольцо с четкой границей */}
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="16"
          opacity="1"
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
            transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease',
          }}
        />
      </svg>
    </div>
  );
};
