import { Input } from "heroui-native/input";
import { TextField } from "heroui-native/text-field";
import React from "react";
import type { TextInputProps } from "react-native";

import { AUTH_INPUT_ROW_CLASS, AUTH_PLACEHOLDER } from "./auth-theme";

export type AuthTextInputRowProps = TextInputProps & {
  placeholder: string;
  variant?: "primary" | "secondary";
};

export function AuthTextInputRow({
  placeholder,
  placeholderTextColor = AUTH_PLACEHOLDER,
  variant = "secondary",
  className,
  ...rest
}: AuthTextInputRowProps) {
  return (
    <TextField className="gap-0">
      <Input
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        variant={variant}
        className={className ?? AUTH_INPUT_ROW_CLASS}
        {...rest}
      />
    </TextField>
  );
}
