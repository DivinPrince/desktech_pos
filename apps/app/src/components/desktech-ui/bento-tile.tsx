import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

type BentoTileProps = {
  title?: string;
  subtitle?: string;
  /** HeroUI semantic surfaces, e.g. bg-success-soft, bg-accent-soft */
  className?: string;
  children?: ReactNode;
};

/** Colored rounded panel for dashboard grids (shift stats, alerts). */
export function BentoTile({
  title,
  subtitle,
  children,
  className = "bg-surface-secondary",
}: BentoTileProps) {
  return (
    <View className={`overflow-hidden rounded-3xl p-4 ${className}`}>
      {title ? (
        <Text className="text-base font-bold text-foreground">{title}</Text>
      ) : null}
      {subtitle ? (
        <Text className="mt-1 text-[13px] text-foreground/80">{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}
