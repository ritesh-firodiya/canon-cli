import Svg, { Rect } from "react-native-svg";

interface StreakChartProps {
  days: Array<{ date: string; done: number }>;
}

const BAR_WIDTH = 10;
const BAR_GAP = 4;
const HEIGHT = 120;

// Draws every day it is given at a fixed bar width; 90 days overflow the screen.
export function StreakChart({ days }: StreakChartProps) {
  return (
    <Svg width={days.length * (BAR_WIDTH + BAR_GAP)} height={HEIGHT}>
      {days.map((day, index) => (
        <Rect key={day.date} x={index * (BAR_WIDTH + BAR_GAP)} y={HEIGHT - day.done * HEIGHT} width={BAR_WIDTH} height={day.done * HEIGHT} />
      ))}
    </Svg>
  );
}
