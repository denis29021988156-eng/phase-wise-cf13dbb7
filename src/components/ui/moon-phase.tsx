import { cn } from "@/lib/utils";

interface MoonPhaseProps {
  value: number; // 0-100
  className?: string;
}

export const MoonPhase = ({ value, className }: MoonPhaseProps) => {
  // Gradient color from red to green based on value
  const getColor = (val: number) => {
    if (val <= 20) return '#EF4444'; // red
    if (val <= 40) return '#F97316'; // orange
    if (val <= 60) return '#EAB308'; // yellow
    if (val <= 80) return '#84CC16'; // lime
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
        {/* Outer border circle */}
        <circle
          cx="100"
          cy="100"
          r="93"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
          opacity="0.5"
        />
        
        {/* Inner border circle */}
        <circle
          cx="100"
          cy="100"
          r="77"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
          opacity="0.5"
        />
        
        {/* Background ring - more visible */}
        <circle
          cx="100"
          cy="100"
          r="85"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="16"
          opacity="0.3"
        />
        
        {/* Progress ring with gradient color */}
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
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        />
      </svg>
    </div>
  );
};
