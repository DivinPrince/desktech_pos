import { useLocalSearchParams } from "expo-router";
import React from "react";

import { ProductEditor } from "@/components/inventory/product-editor";

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductEditor productId={id} />;
}
