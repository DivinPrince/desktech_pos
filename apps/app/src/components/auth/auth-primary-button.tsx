import { Button } from "heroui-native/button";
import React from "react";
import type { PressableProps } from "react-native";

import { AUTH_CORAL } from "./auth-theme";

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
      size="md"
      className="w-full"
      style={{ backgroundColor: AUTH_CORAL }}
      isDisabled={loading}
      onPress={onPress}
    >
      <Button.Label className="font-semibold text-white">
        {loading ? loadingLabel : label}
      </Button.Label>
    </Button>
  );
}
