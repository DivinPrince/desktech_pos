import { Separator } from "heroui-native/separator";
import React from "react";
import { StyleSheet } from "react-native";

export function AuthFieldSeparator() {
  return (
    <Separator
      orientation="horizontal"
      className="bg-border"
      thickness={StyleSheet.hairlineWidth}
    />
  );
}
