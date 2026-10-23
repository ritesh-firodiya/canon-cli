import { Pressable, Text } from "react-native";

interface HabitRowProps {
  name: string;
  onComplete: () => void;
}

export function HabitRow({ name, onComplete }: HabitRowProps) {
  return (
    <Pressable onPress={onComplete} className="flex-row justify-between p-3">
      <Text className="text-ink">{name}</Text>
      <Text className="text-brand-500">Complte</Text>
    </Pressable>
  );
}
