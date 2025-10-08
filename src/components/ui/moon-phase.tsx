import { cn } from "@/lib/utils";

interface MoonPhaseProps {
  value: number; // 0-100
  className?: string;
}

export const MoonPhase = ({ value, className }: MoonPhaseProps) => {
  // Определяем цвет в зависимости от значения
  const getColor = (val: number) => {
    if (val <= 30) return 'hsl(var(--destructive))';
    if (val <= 60) return 'hsl(45 93% 47%)'; // yellow
    return 'hsl(142 76% 36%)'; // green
  };

  const color = getColor(value);
  const percentage = value / 100;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
      >
        {/* Фон круга (тень луны) */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="hsl(var(--secondary))"
          opacity="0.3"
        />
        
        {/* Основной круг луны */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="hsl(var(--secondary))"
          opacity="0.5"
        />

        {/* Фаза луны - освещенная часть */}
        <defs>
          <clipPath id={`moonClip-${value}`}>
            {percentage <= 0.5 ? (
              // Растущая луна (0-50%)
              <ellipse
                cx={100 - (90 * (1 - percentage * 2))}
                cy="100"
                rx={90 * percentage * 2}
                ry="90"
              />
            ) : (
              // Убывающая луна (50-100%)
              <>
                <circle cx="100" cy="100" r="90" />
                <ellipse
                  cx={100 + (90 * ((percentage - 0.5) * 2))}
                  cy="100"
                  rx={90 * (1 - (percentage - 0.5) * 2)}
                  ry="90"
                  fill="black"
                />
              </>
            )}
          </clipPath>
        </defs>

        {/* Освещенная часть с градиентом */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill={color}
          clipPath={`url(#moonClip-${value})`}
          style={{
            filter: 'drop-shadow(0 0 10px currentColor)',
          }}
        />

        {/* Внешний контур */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
          opacity="0.3"
        />
      </svg>
    </div>
  );
};
