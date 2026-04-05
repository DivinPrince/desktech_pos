import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useThemeColor } from "heroui-native/hooks";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { KeyboardAvoidingScaffold } from "@/components/desktech-ui/keyboard-avoiding-scaffold";

type CalcOp = "+" | "-" | "*" | "/";

function applyOp(a: number, b: number, op: CalcOp): number | "error" {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? "error" : a / b;
  }
}

function formatForDisplay(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const rounded = Math.round(n * 1e10) / 1e10;
  let s = String(rounded);
  if (s === "-0") s = "0";
  if (s.length > 14) return n.toExponential(6);
  return s;
}

function parseDisplay(s: string): number | null {
  if (s === "Error" || s === "" || s === ".") return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function opSymbol(op: CalcOp | null): string {
  if (!op) return "";
  switch (op) {
    case "+":
      return "+";
    case "-":
      return "−";
    case "*":
      return "×";
    case "/":
      return "÷";
  }
}

export type CalculatorSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** Immediate-execution chain (left-to-right), same family as many phone calculators. */
export function CalculatorSheet({ visible, onClose }: CalculatorSheetProps) {
  const accent = useThemeColor("accent");
  const accentFg = useThemeColor("accent-foreground");
  const foreground = useThemeColor("foreground");
  const surface = useThemeColor("surface");

  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<CalcOp | null>(null);
  const [shouldReplace, setShouldReplace] = useState(true);

  const reset = useCallback(() => {
    setDisplay("0");
    setAcc(null);
    setPendingOp(null);
    setShouldReplace(true);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const expressionHint = useMemo(() => {
    if (display === "Error") return "";
    if (acc === null || pendingOp === null) return "";
    return `${formatForDisplay(acc)} ${opSymbol(pendingOp)}`;
  }, [acc, pendingOp, display]);

  const tap = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const appendDigit = useCallback(
    (d: string) => {
      tap();
      if (display === "Error") {
        setDisplay(d === "0" ? "0" : d);
        setAcc(null);
        setPendingOp(null);
        setShouldReplace(false);
        return;
      }
      if (shouldReplace) {
        setDisplay(d === "0" ? "0" : d);
        setShouldReplace(false);
        return;
      }
      if (display === "0" && d !== "0") {
        setDisplay(d);
        return;
      }
      if (display.length >= 14) return;
      setDisplay((prev) => prev + d);
    },
    [display, shouldReplace, tap],
  );

  const appendDecimal = useCallback(() => {
    tap();
    if (display === "Error") {
      setDisplay("0.");
      setAcc(null);
      setPendingOp(null);
      setShouldReplace(false);
      return;
    }
    if (shouldReplace) {
      setDisplay("0.");
      setShouldReplace(false);
      return;
    }
    if (display.includes(".")) return;
    setDisplay((prev) => `${prev}.`);
  }, [display, shouldReplace, tap]);

  const backspace = useCallback(() => {
    tap();
    if (display === "Error") {
      reset();
      return;
    }
    if (shouldReplace) return;
    if (display.length <= 1) {
      setDisplay("0");
      setShouldReplace(true);
      return;
    }
    setDisplay((prev) => prev.slice(0, -1));
  }, [display, shouldReplace, reset, tap]);

  const allClear = useCallback(() => {
    tap();
    reset();
  }, [reset, tap]);

  const commitOp = useCallback(
    (nextOp: CalcOp) => {
      tap();
      if (display === "Error") return;
      const n = parseDisplay(display);
      if (n === null) return;

      if (acc !== null && pendingOp !== null && !shouldReplace) {
        const r = applyOp(acc, n, pendingOp);
        if (r === "error") {
          setDisplay("Error");
          setAcc(null);
          setPendingOp(null);
          setShouldReplace(true);
          return;
        }
        const formatted = formatForDisplay(r);
        setDisplay(formatted);
        setAcc(r);
        setPendingOp(nextOp);
        setShouldReplace(true);
        return;
      }

      if (acc !== null && pendingOp !== null && shouldReplace) {
        setPendingOp(nextOp);
        return;
      }

      setAcc(n);
      setPendingOp(nextOp);
      setShouldReplace(true);
    },
    [acc, display, pendingOp, shouldReplace, tap],
  );

  const equals = useCallback(() => {
    tap();
    if (display === "Error") return;
    const n = parseDisplay(display);
    if (n === null || acc === null || pendingOp === null) return;
    const r = applyOp(acc, n, pendingOp);
    if (r === "error") {
      setDisplay("Error");
      setAcc(null);
      setPendingOp(null);
      setShouldReplace(true);
      return;
    }
    setDisplay(formatForDisplay(r));
    setAcc(null);
    setPendingOp(null);
    setShouldReplace(true);
  }, [acc, display, pendingOp, tap]);

  const keyH = 60;
  const gap = 10;

  type KeySpec =
    | { kind: "digit"; v: string; span?: number }
    | { kind: "dec" }
    | { kind: "op"; op: CalcOp }
    | { kind: "ac" }
    | { kind: "bs" };

  const rows: KeySpec[][] = [
    [
      { kind: "ac" },
      { kind: "bs" },
      { kind: "op", op: "/" },
      { kind: "op", op: "*" },
    ],
    [
      { kind: "digit", v: "7" },
      { kind: "digit", v: "8" },
      { kind: "digit", v: "9" },
      { kind: "op", op: "-" },
    ],
    [
      { kind: "digit", v: "4" },
      { kind: "digit", v: "5" },
      { kind: "digit", v: "6" },
      { kind: "op", op: "+" },
    ],
  ];

  const bottomRowsHeight = keyH * 2 + gap;

  const renderKey = (spec: KeySpec, idx: number) => {
    const span = spec.kind === "digit" && spec.span === 2 ? 2 : 1;
    const baseStyle = {
      height: keyH,
      flex: span,
      borderRadius: 16,
    };

    if (spec.kind === "digit") {
      return (
        <Pressable
          key={`d-${spec.v}-${idx}`}
          accessibilityRole="button"
          accessibilityLabel={`${spec.v}`}
          onPress={() => appendDigit(spec.v)}
          className="items-center justify-center active:opacity-80"
          style={[baseStyle, { backgroundColor: surface }]}
        >
          <Text className="text-[24px] font-bold tabular-nums" style={{ color: foreground }}>
            {spec.v}
          </Text>
        </Pressable>
      );
    }
    if (spec.kind === "dec") {
      return (
        <Pressable
          key="dec"
          accessibilityRole="button"
          accessibilityLabel="Decimal point"
          onPress={appendDecimal}
          className="items-center justify-center active:opacity-80"
          style={[baseStyle, { backgroundColor: surface }]}
        >
          <Text className="text-[24px] font-bold tabular-nums" style={{ color: foreground }}>
            .
          </Text>
        </Pressable>
      );
    }
    if (spec.kind === "op") {
      const label = opSymbol(spec.op);
      return (
        <Pressable
          key={spec.op}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => commitOp(spec.op)}
          className="items-center justify-center active:opacity-80"
          style={[baseStyle, { backgroundColor: accent }]}
        >
          <Text className="text-[24px] font-bold tabular-nums" style={{ color: accentFg }}>
            {label}
          </Text>
        </Pressable>
      );
    }
    if (spec.kind === "ac") {
      return (
        <Pressable
          key="ac"
          accessibilityRole="button"
          accessibilityLabel="All clear"
          onPress={allClear}
          className="items-center justify-center active:opacity-80"
          style={[baseStyle, { backgroundColor: `${accent}33` }]}
        >
          <Text className="text-[17px] font-black tabular-nums" style={{ color: accent }}>
            AC
          </Text>
        </Pressable>
      );
    }
    return (
      <Pressable
        key="bs"
        accessibilityRole="button"
        accessibilityLabel="Backspace"
        onPress={backspace}
        className="items-center justify-center active:opacity-80"
        style={[baseStyle, { backgroundColor: `${accent}33` }]}
      >
        <Ionicons name="backspace-outline" size={22} color={accent} />
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingScaffold className="bg-black/45" style={{ justifyContent: "flex-end" }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss" />
        <View className="rounded-t-[32px] bg-background px-5 pb-8 pt-4">
          <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-muted/40" />
          <Text className="text-[22px] font-black tracking-tight text-foreground">Calculator</Text>

          <View className="mt-5 rounded-[24px] border border-border/50 bg-surface px-4 py-4">
            <Text
              className="min-h-[22px] text-right text-[15px] font-semibold tabular-nums text-muted"
              numberOfLines={1}
            >
              {expressionHint}
            </Text>
            <Text
              className="mt-1 text-right text-[40px] font-black tabular-nums tracking-tight text-foreground"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.45}
            >
              {display}
            </Text>
          </View>

          <View className="mt-4" style={{ gap }}>
            {rows.map((row, ri) => (
              <View key={ri} className="flex-row" style={{ gap }}>
                {row.map((k, ki) => renderKey(k, ki))}
              </View>
            ))}
            <View className="flex-row" style={{ gap, alignItems: "stretch" }}>
              <View style={{ flex: 3, height: bottomRowsHeight, gap }}>
                <View className="flex-row" style={{ gap, height: keyH }}>
                  {renderKey({ kind: "digit", v: "1" }, 0)}
                  {renderKey({ kind: "digit", v: "2" }, 1)}
                  {renderKey({ kind: "digit", v: "3" }, 2)}
                </View>
                <View className="flex-row" style={{ gap, height: keyH }}>
                  {renderKey({ kind: "digit", v: "0", span: 2 }, 0)}
                  {renderKey({ kind: "dec" }, 1)}
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Equals"
                onPress={equals}
                className="items-center justify-center active:opacity-80"
                style={{
                  flex: 1,
                  height: bottomRowsHeight,
                  borderRadius: 16,
                  backgroundColor: accent,
                }}
              >
                <Text className="text-[32px] font-black tabular-nums" style={{ color: accentFg }}>
                  =
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingScaffold>
    </Modal>
  );
}
