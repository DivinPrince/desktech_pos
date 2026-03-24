import React from "react";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";

export default function ReportsTab() {
  return (
    <TabScreenScaffold
      title="Reports"
      subtitle="Understand how your business is performing over time."
      paragraphs={[
        "Here you will see daily and weekly sales totals, payment mix, and trends so you can spot busy periods and quieter days at a glance.",
        "Later we can add exports, staff performance summaries, and comparison with previous periods—all in one place.",
      ]}
    />
  );
}
