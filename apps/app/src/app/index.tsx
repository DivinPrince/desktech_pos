import React from "react";
import { View } from "react-native";
import { Button } from "heroui-native/button";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Button onPress={() => console.log("Pressed!")}>Get started</Button>
    </View>
  );
}
