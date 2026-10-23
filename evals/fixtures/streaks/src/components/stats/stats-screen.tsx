import { View } from "react-native";
import { StreakChart } from "./streak-chart";
import { useStreakHistory } from "@/hooks/use-streak-history";

export function StatsScreen() {
  const days = useStreakHistory(90);
  return (
    <View className="flex-1 bg-page p-4">
      <StreakChart days={days} />
    </View>
  );
}
