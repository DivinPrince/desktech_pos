import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { Input } from "heroui-native/input";
import { Surface } from "heroui-native/surface";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { KeyboardScreen } from "@/components/layout/keyboard-screen";
import { authClient } from "@/lib/auth-client";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-none py-2.5 px-4 text-[15px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

export default function ForgotPasswordScreen() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.show({
        label: "Email required",
        description: "Enter the email for your account.",
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await authClient.forgetPassword({
        email: trimmedEmail,
        redirectTo: "desktech://login",
      });

      if (error) {
        toast.show({
          label: "Could not send reset email",
          description: error.message ?? "Please try again.",
          variant: "danger",
        });
        return;
      }

      toast.show({
        label: "Reset email sent",
        description:
          "Check your inbox for the password reset link, then come back and log in.",
        variant: "success",
        duration: "persistent",
      });
    } finally {
      setSubmitting(false);
    }
  }, [email, toast]);

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="inverted" />

      <KeyboardScreen
        scrollContentStyle={[styles.scrollInner, { paddingHorizontal: 28, paddingTop: 36 }]}
      >
        <View style={styles.centerColumn}>
          <View className="items-center px-1">
            <Text className="text-center text-[1.875rem] font-bold text-foreground">
              Reset password
            </Text>
            <Text className="mt-2 max-w-[280px] text-center text-[15px] leading-snug text-muted">
              Enter your email and we will send you a link to reset your password.
            </Text>
          </View>

          <Surface
            variant="default"
            className="mt-6 w-full overflow-hidden rounded-xl bg-surface shadow-surface"
          >
            <TextField className="gap-0">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                variant="secondary"
                className={INPUT_ROW_CLASS}
              />
            </TextField>
          </Surface>

          <View className="mt-5 w-full">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              isDisabled={submitting}
              onPress={onSubmit}
            >
              <Button.Label className="font-semibold text-accent-foreground">
                {submitting ? "Sending…" : "Send reset link"}
              </Button.Label>
            </Button>

            <Link href="/login" asChild>
              <Button variant="ghost" className="mt-3">
                <Button.Label>Back to log in</Button.Label>
              </Button>
            </Link>
          </View>
        </View>
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollInner: {
    flexGrow: 1,
    justifyContent: "center",
  },
  centerColumn: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
});
