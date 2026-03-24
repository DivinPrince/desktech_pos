import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";

import { CategoryEditor } from "@/components/inventory/category-editor";

function pickParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function NewCategoryScreen() {
  const { suggestName } = useLocalSearchParams<{
    suggestName?: string | string[];
  }>();
  const suggestedName = useMemo(() => pickParam(suggestName)?.trim(), [suggestName]);

  return <CategoryEditor suggestedName={suggestedName || undefined} />;
}
