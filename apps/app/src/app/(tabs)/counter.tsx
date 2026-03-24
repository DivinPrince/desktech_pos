import React from "react";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";

export default function CounterTab() {
  return (
    <TabScreenScaffold
      title="Counter"
      subtitle="Ring up sales, take payment, and finish the sale."
      paragraphs={[
        "The counter is where cashiers add line items, apply discounts, choose payment methods, and print or email receipts. It stays fast and obvious under pressure.",
        "Next steps here include a cart, tender types, hold and recall tickets, and customer lookup when you need it.",
      ]}
    />
  );
}
