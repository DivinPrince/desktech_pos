import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native/hooks";
import { useToast } from "heroui-native/toast";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiSdk } from "@/lib/api-sdk";
import { authClient } from "@/lib/auth-client";
import { resolveActiveBusiness, useAuthSessionState } from "@/lib/auth-session";
import { useBusinessesQuery } from "@/lib/queries/business-catalog";

const SHEET_MAX_WIDTH = 340;
const NAV_LINKS: {
  href:
    | "/(tabs)/dashboard"
    | "/(tabs)/today"
    | "/(tabs)/receipts"
    | "/(tabs)/counter"
    | "/(tabs)/items"
    | "/(tabs)/reports"
    | "/(tabs)/items/inventory";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { href: "/(tabs)/dashboard", label: "Dashboard", icon: "grid-outline" },
  { href: "/(tabs)/today", label: "Today", icon: "calendar-outline" },
  { href: "/(tabs)/receipts", label: "Receipts", icon: "receipt-outline" },
  { href: "/(tabs)/counter", label: "Counter", icon: "storefront-outline" },
  { href: "/(tabs)/items", label: "Items", icon: "cube-outline" },
  { href: "/(tabs)/items/inventory", label: "Inventory", icon: "albums-outline" },
  { href: "/(tabs)/reports", label: "Reports", icon: "bar-chart-outline" },
];

type NavigationShellContextValue = {
  openMenu: () => void;
  closeMenu: () => void;
};

const NavigationShellContext = createContext<NavigationShellContextValue | null>(null);

export function useNavigationShell(): NavigationShellContextValue {
  const ctx = useContext(NavigationShellContext);
  if (!ctx) {
    throw new Error("useNavigationShell must be used within NavigationShellProvider");
  }
  return ctx;
}

type AppNavSideSheetProps = {
  visible: boolean;
  onClose: () => void;
};

function AppNavSideSheet({ visible, onClose }: AppNavSideSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();
  const sdk = useApiSdk();
  const { session, user, refetch: refetchSession } = useAuthSessionState();
  const businessesQuery = useBusinessesQuery(Boolean(user));
  const businesses = businessesQuery.data ?? [];
  const currentBusiness = useMemo(
    () => resolveActiveBusiness(session, businessesQuery.data),
    [session, businessesQuery.data],
  );
  const activeId = currentBusiness?.id;

  const fg = useThemeColor("foreground");
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const surface = useThemeColor("background");
  const border = useThemeColor("border");

  const sheetWidth = useMemo(() => {
    const w = Dimensions.get("window").width;
    return Math.min(SHEET_MAX_WIDTH, Math.round(w * 0.88));
  }, []);

  const slide = useRef(new Animated.Value(-sheetWidth)).current;
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      slide.setValue(-sheetWidth);
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 65,
      }).start();
    } else {
      Animated.timing(slide, {
        toValue: -sheetWidth,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sheetWidth, slide]);

  const displayName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : user?.email ?? "Account";

  const onSelectBusiness = useCallback(
    async (businessId: string) => {
      if (businessId === activeId) {
        onClose();
        return;
      }
      setSwitchingId(businessId);
      try {
        await sdk.businesses.selectActive(businessId);
        await refetchSession();
        onClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not switch workspace.";
        toast.show({ label: "Switch failed", description: msg, variant: "danger" });
      } finally {
        setSwitchingId(null);
      }
    },
    [activeId, onClose, refetchSession, sdk.businesses, toast],
  );

  const onSignOut = useCallback(async () => {
    onClose();
    try {
      await authClient.signOut();
    } catch {
      /* still route guest — session cookie may be cleared */
    }
    router.replace("/login");
  }, [onClose, router]);

  const onNavigate = useCallback(
    (href: (typeof NAV_LINKS)[number]["href"]) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
        <Animated.View
          style={[
            styles.sheet,
            {
              width: sheetWidth,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: surface,
              borderRightColor: border,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View className="px-4 pb-4">
              <Text style={{ color: fg }} className="text-[18px] font-bold" numberOfLines={1}>
                {displayName}
              </Text>
              {user?.email && displayName !== user.email ? (
                <Text style={{ color: muted }} className="mt-1 text-[14px]" numberOfLines={2}>
                  {user.email}
                </Text>
              ) : null}
            </View>

            <Text style={{ color: muted }} className="px-4 pb-2 text-[12px] font-semibold uppercase tracking-wide">
              Workspace
            </Text>
            {businessesQuery.isError ? (
              <Text style={{ color: muted }} className="px-4 pb-3 text-[14px]">
                Could not load businesses.
              </Text>
            ) : businesses.length === 0 ? (
              <Text style={{ color: muted }} className="px-4 pb-3 text-[14px]">
                No workspaces yet.
              </Text>
            ) : (
              <View className="px-2">
                {businesses.map((b) => {
                  const selected = b.id === activeId;
                  const busy = switchingId === b.id;
                  return (
                    <Pressable
                      key={b.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={busy}
                      onPress={() => void onSelectBusiness(b.id)}
                      className="min-h-[48px] flex-row items-center justify-between rounded-xl px-3 py-2.5 active:bg-accent/10"
                    >
                      <View className="min-w-0 flex-1 pr-2">
                        <Text
                          style={{ color: fg }}
                          className="text-[16px] font-semibold"
                          numberOfLines={1}
                        >
                          {b.name}
                        </Text>
                        <Text style={{ color: muted }} className="text-[13px]" numberOfLines={1}>
                          {b.currency}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator color={accent} />
                      ) : selected ? (
                        <Ionicons name="checkmark-circle" size={22} color={accent} />
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color={muted} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View className="mx-4 my-4 h-px bg-border/80" />

            <Text style={{ color: muted }} className="px-4 pb-2 text-[12px] font-semibold uppercase tracking-wide">
              Navigate
            </Text>
            <View className="px-2">
              {NAV_LINKS.map((link) => (
                <Pressable
                  key={link.href}
                  accessibilityRole="button"
                  onPress={() => onNavigate(link.href)}
                  className="min-h-[48px] flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-accent/10"
                >
                  <Ionicons name={link.icon} size={22} color={muted} />
                  <Text style={{ color: fg }} className="text-[16px] font-medium">
                    {link.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="mx-4 my-4 h-px bg-border/80" />

            <View className="px-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => void onSignOut()}
                className="min-h-[52px] flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-red-500/12"
              >
                <Ionicons name="log-out-outline" size={22} color="#dc2626" />
                <Text className="text-[16px] font-semibold text-red-600 dark:text-red-400">
                  Log out
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    flex: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
});

export function NavigationShellProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const value = useMemo(
    () => ({
      openMenu: () => setMenuOpen(true),
      closeMenu: () => setMenuOpen(false),
    }),
    [],
  );

  return (
    <NavigationShellContext.Provider value={value}>
      {children}
      <AppNavSideSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </NavigationShellContext.Provider>
  );
}

type NavigationMenuTriggerProps = {
  /** Icon color (e.g. accent header foreground). */
  iconColor: string;
};

export function NavigationMenuTrigger({ iconColor }: NavigationMenuTriggerProps) {
  const { openMenu } = useNavigationShell();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      onPress={openMenu}
      style={({ pressed }) => ({
        height: 44,
        width: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.22)",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name="menu-outline" size={28} color={iconColor} />
    </Pressable>
  );
}
