import { Card } from "heroui-native/card";
import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

type FormSectionCardProps = {
  title: string;
  children: ReactNode;
};

/** Grouped form block with section title (inventory / catalog editors). */
export function FormSectionCard({ title, children }: FormSectionCardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-border/80 p-0 shadow-none">
      <View className="border-b border-border/60 bg-surface-secondary/40 px-4 py-2.5">
        <Text className="text-[12px] font-semibold uppercase tracking-wide text-muted">
          {title}
        </Text>
      </View>
      <View className="gap-2 px-3 py-3">{children}</View>
    </Card>
  );
}
