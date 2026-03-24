import { Ionicons } from "@expo/vector-icons";
import { Card } from "heroui-native/card";
import { useThemeColor } from "heroui-native/hooks";
import type { SurfaceVariant } from "heroui-native/surface";
import React, { createContext, useContext, type ReactNode } from "react";
import { Pressable, View } from "react-native";

type GridRootProps = {
  children: ReactNode;
  className?: string;
};

type ProductGridColumnsValue = { numColumns: number };

/** Fixed 3 columns in portrait for consistent, readable product tiles. */
const GRID_COLUMNS = 3;

const ProductGridColumnsContext = createContext<ProductGridColumnsValue>({
  numColumns: GRID_COLUMNS,
});

function GridCell({ children }: { children: ReactNode }) {
  const { numColumns } = useContext(ProductGridColumnsContext);
  return (
    <View
      style={{ width: `${100 / numColumns}%` }}
      className="mb-3 px-1.5"
    >
      {children}
    </View>
  );
}

function ProductListGridRoot({ children, className = "" }: GridRootProps) {
  return (
    <ProductGridColumnsContext.Provider value={{ numColumns: GRID_COLUMNS }}>
      <View className={`flex-row flex-wrap ${className}`}>{children}</View>
    </ProductGridColumnsContext.Provider>
  );
}

/** Media band + body tuned for readable POS tiles (portrait, multi-column). */
const MEDIA_BAND = "h-[92px] w-full items-center justify-center";
const BODY_PAD = "gap-1 px-2.5 py-2";
const TITLE_CARD = "text-[15px] font-semibold leading-snug";
/** Single line: avoids wrap jitter that made cards uneven height. */
const PRICE_ROW =
  "text-[14px] font-semibold tabular-nums leading-[18px] text-foreground";
const META_LINE = "text-[14px] font-medium leading-[18px] tabular-nums";
/** Solid product image placeholder (no icon). */
const PLACEHOLDER_CIRCLE =
  "h-[58px] w-[58px] shrink-0 rounded-full";

/** Slightly stronger than hairline; `shadow-none` overrides HeroUI Surface default shadow. */
const CARD_OUTLINE_SOLID = "border border-border/75 shadow-none";
const CARD_OUTLINE_DASHED = "border border-dashed border-border/75 shadow-none";

type ProductCardProps = {
  title: string;
  price: string;
  onPress?: () => void;
  /** HeroUI `Card` / `Surface` variant */
  variant?: SurfaceVariant;
  /** Classes on the root `Card` (layout, border, radius). */
  className?: string;
};

function ProductCard({
  title,
  price,
  onPress,
  variant = "default",
  className = "",
}: ProductCardProps) {
  const danger = useThemeColor("danger");

  const card = (
    <Card
      variant={variant}
      className={`overflow-hidden rounded-2xl p-0 ${CARD_OUTLINE_SOLID} ${className}`}
    >
      <Card.Header className="p-0">
        <View className={MEDIA_BAND}>
          <View
            className={PLACEHOLDER_CIRCLE}
            style={{ backgroundColor: danger }}
          />
        </View>
      </Card.Header>
      <Card.Body className={BODY_PAD}>
        <Card.Title className={TITLE_CARD} numberOfLines={2}>
          {title}
        </Card.Title>
        <Card.Description
          className={PRICE_ROW}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {price}
        </Card.Description>
      </Card.Body>
    </Card>
  );

  return (
    <GridCell>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${price}`}
          onPress={onPress}
          className="active:opacity-90"
        >
          {card}
        </Pressable>
      ) : (
        card
      )}
    </GridCell>
  );
}

type OtherCardProps = {
  label?: string;
  onPress?: () => void;
  variant?: SurfaceVariant;
  className?: string;
};

function OtherCard({
  label = "Other",
  onPress,
  variant = "secondary",
  className = "",
}: OtherCardProps) {
  const danger = useThemeColor("danger");

  const card = (
    <Card
      variant={variant}
      className={`overflow-hidden rounded-2xl p-0 ${CARD_OUTLINE_DASHED} ${className}`}
    >
      <Card.Header className="p-0">
        <View className={MEDIA_BAND}>
          <View
            className={PLACEHOLDER_CIRCLE}
            style={{ backgroundColor: danger }}
          />
        </View>
      </Card.Header>
      <Card.Body className={BODY_PAD}>
        <Card.Title
          className={`text-center ${TITLE_CARD}`}
          numberOfLines={2}
        >
          {label}
        </Card.Title>
        <Card.Description
          className={`text-center ${META_LINE} opacity-0`}
          numberOfLines={1}
        >
          {"\u00a0"}
        </Card.Description>
      </Card.Body>
    </Card>
  );

  return (
    <GridCell>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          className="active:opacity-90"
        >
          {card}
        </Pressable>
      ) : (
        card
      )}
    </GridCell>
  );
}

type AddItemCardProps = {
  label?: string;
  onPress?: () => void;
  variant?: SurfaceVariant;
  className?: string;
};

function AddItemCard({
  label = "Add item",
  onPress,
  variant = "secondary",
  className = "",
}: AddItemCardProps) {
  const accent = useThemeColor("accent");
  /** One token for every layer so default Card `bg-surface` never shows through. */
  const fill = "bg-surface-secondary";

  const card = (
    <Card
      variant={variant}
      className={`overflow-hidden rounded-2xl p-0 ${CARD_OUTLINE_DASHED} ${className}`}
    >
      <Card.Header className={`p-0 ${fill}`}>
        <View className={`${MEDIA_BAND} ${fill}`}>
          <Ionicons name="add" size={28} color={accent} />
        </View>
      </Card.Header>
      <Card.Body className={`${BODY_PAD} ${fill}`}>
        <Card.Title
          className={`text-center ${TITLE_CARD} ${fill}`}
          numberOfLines={2}
        >
          {label}
        </Card.Title>
        <Card.Description
          className={`text-center ${META_LINE} opacity-0 ${fill}`}
          numberOfLines={1}
        >
          {"\u00a0"}
        </Card.Description>
      </Card.Body>
    </Card>
  );

  return (
    <GridCell>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          className="active:opacity-90"
        >
          {card}
        </Pressable>
      ) : (
        card
      )}
    </GridCell>
  );
}

export const ProductListGrid = Object.assign(ProductListGridRoot, {
  ProductCard,
  OtherCard,
  AddItemCard,
});
