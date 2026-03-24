import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";
import { flushOutboxOnce } from "@/lib/db/flush-outbox";
import { countPendingOutbox, enqueueCreateDraftSale } from "@/lib/db/outbox-ops";
import { authClient } from "@/lib/auth-client";
import type { SessionPayload } from "@/lib/auth-session";
import {
  useBusinessesQuery,
  useCategoriesQuery,
  useProductsQuery,
} from "@/lib/queries/business-catalog";
import { useOnline } from "@/lib/use-online";

const outboxPendingKey = ["outbox", "pending"] as const;

export default function TodayTab() {
  const foreground = useThemeColor("foreground");
  const muted = useThemeColor("muted");
  const accentColor = "#007AFF";
  const { data: session } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const displayName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : user?.email ?? "there";

  const signedIn = Boolean(user);
  const online = useOnline();
  const queryClient = useQueryClient();

  const businessesQuery = useBusinessesQuery(signedIn);
  const firstBusinessId = useMemo(
    () => businessesQuery.data?.[0]?.id,
    [businessesQuery.data],
  );

  const categoriesQuery = useCategoriesQuery(firstBusinessId, signedIn);
  const productsQuery = useProductsQuery(firstBusinessId, signedIn);

  const pendingOutboxQuery = useQuery({
    queryKey: outboxPendingKey,
    queryFn: countPendingOutbox,
    enabled: signedIn,
    refetchInterval: 4000,
  });

  const onQueueDraftSale = useCallback(async () => {
    if (!firstBusinessId) return;
    await enqueueCreateDraftSale(firstBusinessId, {});
    await queryClient.invalidateQueries({ queryKey: outboxPendingKey });
    await flushOutboxOnce();
  }, [firstBusinessId, queryClient]);

  const catalogLoading =
    businessesQuery.isPending || categoriesQuery.isPending || productsQuery.isPending;
  const catalogError =
    businessesQuery.error ?? categoriesQuery.error ?? productsQuery.error;

  const belowTitle = (
    <View style={{ marginTop: 12, gap: 16 }}>
      <Text style={{ color: foreground, fontSize: 18, fontWeight: "600" }}>
        Hi, {displayName}
      </Text>
      <Text style={{ color: muted, fontSize: 14 }}>
        Network: {online ? "online" : "offline"} · TanStack Query cache + SQLite outbox
      </Text>

      {!signedIn ? (
        <Text style={{ color: muted, fontSize: 14 }}>Sign in to load catalog data.</Text>
      ) : businessesQuery.isError ? (
        <Text style={{ color: muted, fontSize: 14 }}>
          Could not load businesses. Pull to refresh when the API is reachable.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ color: foreground, fontSize: 16, fontWeight: "600" }}>
            Catalog (persisted when offline)
          </Text>
          {catalogLoading ? (
            <ActivityIndicator color={accentColor} />
          ) : catalogError ? (
            <Text style={{ color: muted, fontSize: 14 }}>Failed to load catalog.</Text>
          ) : (
            <Text style={{ color: foreground, fontSize: 15, lineHeight: 22 }}>
              {firstBusinessId
                ? `Categories: ${categoriesQuery.data?.length ?? 0} · Products: ${productsQuery.data?.length ?? 0}`
                : "No business yet — finish onboarding or create a business on the server."}
            </Text>
          )}

          <Text style={{ color: foreground, fontSize: 16, fontWeight: "600" }}>
            Outbox
          </Text>
          <Text style={{ color: muted, fontSize: 14, lineHeight: 20 }}>
            Pending operations: {pendingOutboxQuery.data ?? 0}. Queue a draft sale offline; it
            syncs with Idempotency-Key when you are back online.
          </Text>
          <Pressable
            disabled={!firstBusinessId}
            onPress={() => void onQueueDraftSale()}
            style={({ pressed }) => ({
              opacity: !firstBusinessId ? 0.45 : pressed ? 0.85 : 1,
              alignSelf: "flex-start",
              backgroundColor: accentColor,
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 12,
            })}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
              Queue draft sale (outbox)
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <TabScreenScaffold
      title="Today"
      belowTitle={belowTitle}
      subtitle="Your home for what is happening right now at the register."
      paragraphs={[
        "Catalog counts come from the API through TanStack Query with offline-first network mode and AsyncStorage persistence.",
        "The outbox stores draft-sale creates locally and replays them with idempotent headers so retries are safe.",
      ]}
    />
  );
}
