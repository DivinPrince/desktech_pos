import { Ionicons } from "@expo/vector-icons";
import { Card } from "heroui-native/card";
import { useThemeColor } from "heroui-native/hooks";
import type { SurfaceVariant } from "heroui-native/surface";
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { Pressable, Text, View } from "react-native";

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
const MEDIA_BAND = "h-[100px] w-full items-center justify-center bg-surface";
const BODY_PAD = "gap-1.5 px-3 py-3 bg-surface";
const TITLE_CARD = "text-[14px] font-bold leading-tight text-foreground tracking-tight";
/** Single line: avoids wrap jitter that made cards uneven height. */
const PRICE_ROW =
  "text-[13px] font-black tabular-nums leading-[18px] text-muted tracking-tight";
/** Solid product image placeholder (no icon). */
const PLACEHOLDER_CIRCLE =
  "h-[64px] w-[64px] shrink-0 rounded-full items-center justify-center";

/** Slightly stronger than hairline; `shadow-none` overrides HeroUI Surface default shadow. */
const CARD_OUTLINE_SOLID = "border border-border/40 shadow-none";
const CARD_OUTLINE_DASHED = "border border-dashed border-border/40 shadow-none bg-surface/50";

type ProductCardProps = {
  title: string;
  price: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** When > 0, shows an `Nx` pill on the tile (e.g. counter quantity). */
  quantityLabel?: number;
  /** Optional line under price (e.g. stock). */
  footerHint?: string;
  /** When true, `footerHint` uses the danger theme color. */
  footerHintCritical?: boolean;
  /** When true, fades the card and overlays an "Out of stock" badge. */
  isOutOfStock?: boolean;
  /** HeroUI `Card` / `Surface` variant */
  variant?: SurfaceVariant;
  /** Classes on the root `Card` (layout, border, radius). */
  className?: string;
};

function ProductCard({
  title,
  price,
  onPress,
  onLongPress,
  quantityLabel = 0,
  footerHint,
  footerHintCritical = false,
  isOutOfStock = false,
  variant = "default",
  className = "",
}: ProductCardProps) {
  const danger = useThemeColor("danger");
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");

  /** After a long press, RN often still fires `onPress` on release — that re-added one unit. */
  const suppressNextPressRef = useRef(false);

  const handlePress = useCallback(() => {
    if (!onPress) return;
    if (suppressNextPressRef.current) {
      suppressNextPressRef.current = false;
      return;
    }
    onPress();
  }, [onPress]);

  const handleLongPress = useCallback(() => {
    if (!onLongPress) return;
    suppressNextPressRef.current = true;
    onLongPress();
    // If the platform never sends `onPress` after long press, avoid blocking the next tap.
    setTimeout(() => {
      suppressNextPressRef.current = false;
    }, 800);
  }, [onLongPress]);

  const card = (
    <Card
      variant={variant}
      className={`overflow-hidden rounded-[24px] p-0 ${CARD_OUTLINE_SOLID} ${className} ${isOutOfStock ? "opacity-60" : ""}`}
    >
      <Card.Header className="p-0">
        <View className={MEDIA_BAND}>
          <View
            className={PLACEHOLDER_CIRCLE}
            style={{ backgroundColor: `${accent}15` }}
          >
            <Text className="text-[24px] font-black" style={{ color: accent }}>
              {title.charAt(0).toUpperCase()}
            </Text>
          </View>
          {isOutOfStock && (
            <View className="absolute inset-0 items-center justify-center bg-background/50">
              <View className="rounded-md bg-danger px-2 py-1 shadow-sm">
                <Text className="text-[10px] font-black uppercase tracking-widest text-danger-foreground">
                  Out of stock
                </Text>
              </View>
            </View>
          )}
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
        {footerHint && !isOutOfStock ? (
          <Text
            className="mt-0.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: footerHintCritical ? danger : muted }}
            numberOfLines={1}
          >
            {footerHint}
          </Text>
        ) : null}
      </Card.Body>
    </Card>
  );

  const showQty = quantityLabel > 0;

  return (
    <GridCell>
      <View className="relative">
        {showQty ? (
          <View
            className="absolute right-1 top-1 z-10 rounded-full px-1.5 py-0.5"
            style={{ backgroundColor: accent }}
          >
            <Text
              className="text-[11px] font-bold tabular-nums"
              style={{ color: accentFg }}
            >
              {quantityLabel}x
            </Text>
          </View>
        ) : null}
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${price}`}
            onPress={handlePress}
            onLongPress={onLongPress ? handleLongPress : undefined}
            delayLongPress={450}
            className="active:opacity-90"
          >
            {card}
          </Pressable>
        ) : (
          card
        )}
      </View>
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
      className={`overflow-hidden rounded-[24px] p-0 ${CARD_OUTLINE_DASHED} ${className}`}
    >
      <Card.Header className="p-0">
        <View className={MEDIA_BAND}>
          <View
            className={PLACEHOLDER_CIRCLE}
            style={{ backgroundColor: `${danger}15` }}
          >
            <Ionicons name="apps" size={24} color={danger} />
          </View>
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
          className={`text-center ${PRICE_ROW} opacity-0`}
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
      className={`overflow-hidden rounded-[24px] p-0 ${CARD_OUTLINE_DASHED} ${className}`}
    >
      <Card.Header className={`p-0 ${fill}`}>
        <View className={`${MEDIA_BAND} ${fill}`}>
          <View
            className={PLACEHOLDER_CIRCLE}
            style={{ backgroundColor: `${accent}15` }}
          >
            <Ionicons name="add" size={28} color={accent} />
          </View>
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
          className={`text-center ${PRICE_ROW} opacity-0 ${fill}`}
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
