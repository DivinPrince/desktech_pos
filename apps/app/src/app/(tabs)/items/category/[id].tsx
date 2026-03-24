import { useLocalSearchParams } from "expo-router";
import React from "react";

import { CategoryEditor } from "@/components/inventory/category-editor";

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategoryEditor categoryId={id} />;
}
