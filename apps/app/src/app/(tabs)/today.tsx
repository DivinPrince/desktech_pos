import { useThemeColor } from "heroui-native/hooks";
import React, { useMemo } from "react";
import { Text, View } from "react-native";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";
import { authClient } from "@/lib/auth-client";
import type { SessionPayload } from "@/lib/auth-session";
import {
  useBusinessesQuery,
  useCategoriesQuery,
  useProductsQuery,
} from "@/lib/queries/business-catalog";

export default function TodayTab() {
  const foreground = useThemeColor("foreground");
  const muted = useThemeColor("muted");
  const { data: session } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const displayName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : user?.email ?? "there";

  const signedIn = Boolean(user);

  const businessesQuery = useBusinessesQuery(signedIn);
  const firstBusinessId = useMemo(
    () => businessesQuery.data?.[0]?.id,
    [businessesQuery.data],
  );

  const categoriesQuery = useCategoriesQuery(firstBusinessId, signedIn);
  const productsQuery = useProductsQuery(firstBusinessId, signedIn, {
    activeOnly: true,
  });

  const businesses = businessesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  /** Block only on true cold load (no rows yet). Cached SQLite/API data shows immediately. */
  const catalogBlockingLoad =
    signedIn &&
    !businessesQuery.isError &&
    ((businesses.length === 0 && businessesQuery.isPending) ||
      (Boolean(firstBusinessId) && categories.length === 0 && categoriesQuery.isPending) ||
      (Boolean(firstBusinessId) && products.length === 0 && productsQuery.isPending));

  const catalogRefreshing =
    businessesQuery.isFetching || categoriesQuery.isFetching || productsQuery.isFetching;

  const catalogError =
    businessesQuery.error ?? categoriesQuery.error ?? productsQuery.error;

  const belowTitle = (
    <View style={{ marginTop: 12, gap: 16 }}>
      <Text style={{ color: foreground, fontSize: 18, fontWeight: "600" }}>
        Hi, {displayName}
      </Text>

      {!signedIn ? (
        <Text style={{ color: muted, fontSize: 14 }}>Sign in to load catalog data.</Text>
      ) : businessesQuery.isError ? (
        <Text style={{ color: muted, fontSize: 14 }}>
          Could not load businesses. Pull to refresh when the API is reachable.
        </Text>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ color: foreground, fontSize: 16, fontWeight: "600" }}>Catalog</Text>
          {catalogBlockingLoad ? (
            <Text style={{ color: muted, fontSize: 14 }}>Loading catalog…</Text>
          ) : catalogError ? (
            <Text style={{ color: muted, fontSize: 14 }}>Failed to load catalog.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={{ color: foreground, fontSize: 15, lineHeight: 22 }}>
                {firstBusinessId
                  ? `Categories: ${categories.length} · Products: ${products.length}`
                  : "No business yet — finish onboarding or create a business on the server."}
              </Text>
              {catalogRefreshing && !catalogBlockingLoad ? (
                <Text style={{ color: muted, fontSize: 13 }}>Updating…</Text>
              ) : null}
            </View>
          )}
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
        "Catalog counts use TanStack DB with persisted SQLite on native (TanStack Query under the hood) so last-synced data can appear offline and refresh when you are back online.",
      ]}
    />
  );
}
