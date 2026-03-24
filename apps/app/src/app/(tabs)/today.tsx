import { useThemeColor } from "heroui-native/hooks";
import React from "react";
import { Text } from "react-native";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";
import { authClient } from "@/lib/auth-client";
import type { SessionPayload } from "@/lib/auth-session";

export default function TodayTab() {
  const foreground = useThemeColor("foreground");
  const { data: session } = authClient.useSession();
  const user = (session as SessionPayload | null | undefined)?.user;
  const displayName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : user?.email ?? "there";

  return (
    <TabScreenScaffold
      title="Today"
      belowTitle={
        <Text
          style={{
            color: foreground,
            fontSize: 18,
            fontWeight: "600",
            marginTop: 12,
          }}
        >
          Hi, {displayName}
        </Text>
      }
      subtitle={"Your home for what's happening right now at the register."}
      paragraphs={[
        "This screen will show today’s opening status, running sales, recent transactions, and shortcuts—so you can start the day or jump back in without hunting through menus.",
        "We'll also surface alerts here, like low stock or pending tasks, when those features are wired up.",
      ]}
    />
  );
}
