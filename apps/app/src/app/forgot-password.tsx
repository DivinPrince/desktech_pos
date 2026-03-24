import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  return (
    <View className="flex-1 bg-background">
      <StatusBar style="auto" />
      <SafeAreaView className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-lg text-foreground">
          Password reset coming soon.
        </Text>
        <Link href="/login" asChild>
          <Button variant="ghost" className="mt-6">
            <Button.Label>Back to log in</Button.Label>
          </Button>
        </Link>
      </SafeAreaView>
    </View>
  );
}
