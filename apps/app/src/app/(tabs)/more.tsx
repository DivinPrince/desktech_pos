import React from "react";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";

export default function MoreTab() {
  return (
    <TabScreenScaffold
      title="More"
      subtitle="Settings and tools you do not need every minute."
      paragraphs={[
        "Open business profile, tax and receipt defaults, staff and permissions, printers and hardware, and integrations from one overflow area so the main tabs stay uncluttered.",
        "Help, legal, sign out, and app version will sit here as well—easy to find when you need them, out of the way when you do not.",
      ]}
    />
  );
}
