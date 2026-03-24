import React from "react";

import { TabScreenScaffold } from "@/components/tab-screen-scaffold";

export default function ItemsTab() {
  return (
    <TabScreenScaffold
      title="Items"
      subtitle="Everything you sell, organized and easy to find."
      paragraphs={[
        "Manage products and services: names, prices, SKUs or barcodes, categories, and tax rules. Search and filters will help you update stock without leaving the floor.",
        "Inventory counts, variants, and supplier notes can live here too, so Items becomes the single source of truth for your catalog.",
      ]}
    />
  );
}
