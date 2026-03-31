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
    <View className="mb-2">
      <Text className="text-[14px] font-bold uppercase tracking-widest text-muted mb-3 ml-2">
        {title}
      </Text>
      <View className="overflow-hidden rounded-[28px] bg-surface p-4 gap-3">
        {children}
      </View>
    </View>
  );
}
