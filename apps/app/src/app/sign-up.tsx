import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { Input } from "heroui-native/input";
import { InputGroup } from "heroui-native/input-group";
import { LinkButton } from "heroui-native/link-button";
import { Separator } from "heroui-native/separator";
import { Surface } from "heroui-native/surface";
import { TextField } from "heroui-native/text-field";
import { useToast } from "heroui-native/toast";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { GuestRouteGuard } from "@/components/auth/guest-route-guard";
import { authClient } from "@/lib/auth-client";
import { beginAuthTransition } from "@/lib/auth-session";

const INPUT_ROW_CLASS =
  "border-0 border-transparent bg-transparent rounded-none py-2.5 px-4 text-[15px] leading-5 shadow-none ios:shadow-none android:shadow-none focus:border-transparent text-field-foreground";

const MIN_PASSWORD_LEN = 8;

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const versionLabel = `v${Constants.expoConfig?.version ?? "1.0.0"}`;
  const buildLabel =
    Constants.nativeBuildVersion != null
      ? ` (${Constants.nativeBuildVersion})`
      : "";

  const onSignUp = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      toast.show({
        label: "Name required",
        description: "Please enter your name.",
        variant: "warning",
      });
      return;
    }
    if (!trimmedEmail) {
      toast.show({
        label: "Email required",
        description: "Please enter your email.",
        variant: "warning",
      });
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      toast.show({
        label: "Password too short",
        description: `Use at least ${MIN_PASSWORD_LEN} characters.`,
        variant: "warning",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast.show({
        label: "Passwords do not match",
        description: "Check and try again.",
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await authClient.signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });
      if (error) {
        toast.show({
          label: "Sign up failed",
          description: error.message ?? "Please try again.",
          variant: "danger",
        });
        return;
      }
      const payload = data as Record<string, unknown> | undefined;
      const signedIn = Boolean(
        payload?.session != null ||
          (typeof payload?.token === "string" && payload.token.length > 0),
      );
      if (data?.user && !signedIn) {
        toast.show({
          label: "Check your email",
          description:
            "We sent you a link to verify your account. You can log in once that’s done.",
          variant: "success",
          duration: "persistent",
          actionLabel: "Log in",
          onActionPress: ({ hide }) => {
            hide();
            router.replace("/login");
          },
        });
        return;
      }

      await authClient.getSession().catch(() => null);
      beginAuthTransition("/onboarding");
      router.replace("/onboarding");
    } finally {
      setSubmitting(false);
    }
  }, [confirmPassword, email, name, password, router, toast]);

  return (
    <GuestRouteGuard>
      <View className="flex-1 bg-background">
        <StatusBar style="inverted" />

        <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        <View
          pointerEvents="box-none"
          style={[
            styles.versionBadge,
            { top: insets.top + 4, right: insets.right + 20 },
          ]}
        >
          <Text className="text-[11px] text-muted">
            {versionLabel}
            {buildLabel}
          </Text>
          <Ionicons name="sunny" size={14} color={accentColor} />
        </View>

        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.fill}
            contentContainerStyle={[
              styles.scrollInner,
              { paddingBottom: Math.max(insets.bottom, 20) + 8 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.centerColumn}>
              <View className="items-center px-1">
                <Text className="text-[1.875rem] font-bold text-foreground">
                  Create account
                </Text>
                <Text className="mt-2 max-w-[280px] text-center text-[15px] leading-snug text-muted">
                  Join Desktech to run sales and inventory from one place.
                </Text>
              </View>

              <Surface
                variant="default"
                className="mt-6 w-full overflow-hidden rounded-xl bg-surface shadow-surface"
              >
                <TextField className="gap-0">
                  <Input
                    value={name}
                    onChangeText={setName}
                    placeholder="Name"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    variant="secondary"
                    className={INPUT_ROW_CLASS}
                  />
                </TextField>
                <Separator
                  orientation="horizontal"
                  className="bg-border"
                  thickness={StyleSheet.hairlineWidth}
                />
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
                <Separator
                  orientation="horizontal"
                  className="bg-border"
                  thickness={StyleSheet.hairlineWidth}
                />
                <TextField className="gap-0">
                  <InputGroup className="relative min-h-[44px]">
                    <InputGroup.Input
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      variant="secondary"
                      className={INPUT_ROW_CLASS}
                    />
                    <InputGroup.Suffix>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          showPassword ? "Hide password" : "Show password"
                        }
                        hitSlop={10}
                        onPress={() => setShowPassword((v) => !v)}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off" : "eye"}
                          size={20}
                          color={accentColor}
                        />
                      </Pressable>
                    </InputGroup.Suffix>
                  </InputGroup>
                </TextField>
                <Separator
                  orientation="horizontal"
                  className="bg-border"
                  thickness={StyleSheet.hairlineWidth}
                />
                <TextField className="gap-0">
                  <InputGroup className="relative min-h-[44px]">
                    <InputGroup.Input
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm password"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      variant="secondary"
                      className={INPUT_ROW_CLASS}
                    />
                    <InputGroup.Suffix>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        hitSlop={10}
                        onPress={() => setShowConfirmPassword((v) => !v)}
                      >
                        <Ionicons
                          name={showConfirmPassword ? "eye-off" : "eye"}
                          size={20}
                          color={accentColor}
                        />
                      </Pressable>
                    </InputGroup.Suffix>
                  </InputGroup>
                </TextField>
              </Surface>

              <View className="mt-5 w-full">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  isDisabled={submitting}
                  onPress={onSignUp}
                >
                  <Button.Label className="font-semibold text-accent-foreground">
                    {submitting ? "Creating account…" : "Sign up"}
                  </Button.Label>
                </Button>
                <View className="mt-3 items-center">
                  <LinkButton
                    accessibilityRole="link"
                    onPress={() => router.push("/login")}
                  >
                    <LinkButton.Label className="text-[15px] text-accent">
                      Already have an account? Log in
                    </LinkButton.Label>
                  </LinkButton>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </GuestRouteGuard>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  versionBadge: {
    position: "absolute",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scrollInner: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 36,
  },
  centerColumn: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
});
