import { Button } from "heroui-native/button";
import React from "react";
import type { PressableProps } from "react-native";

type AuthPrimaryButtonProps = {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  onPress: PressableProps["onPress"];
};

export function AuthPrimaryButton({
  label,
  loadingLabel = "Please wait…",
  loading = false,
  onPress,
}: AuthPrimaryButtonProps) {
  return (
    <Button
      variant="primary"
      size="md"
      className="w-full"
      isDisabled={loading}
      onPress={onPress}
    >
      <Button.Label className="font-semibold text-accent-foreground">
        {loading ? loadingLabel : label}
      </Button.Label>
    </Button>
  );
}
