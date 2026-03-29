import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Stroke dash length for `CHECK_D` (viewBox 0 0 100 100). Tuned so the check
 * fully draws without clipping.
 */
const CHECK_PATH_LENGTH = 112;

/** Rounded check: short leg, long leg. */
const CHECK_D = "M 22 52 L 45 74 L 80 31";

type Props = {
  color: string;
  size?: number;
  /** Delay before stroke starts (ms). */
  startDelayMs?: number;
  /** Stroke animation duration (ms). */
  drawDurationMs?: number;
};

export function AnimatedSuccessCheck({
  color,
  size = 88,
  startDelayMs = 140,
  drawDurationMs = 540,
}: Props) {
  const draw = useSharedValue(CHECK_PATH_LENGTH);

  const onDrawComplete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    draw.value = CHECK_PATH_LENGTH;
    draw.value = withDelay(
      startDelayMs,
      withTiming(0, {
        duration: drawDurationMs,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(onDrawComplete)();
        }
      }),
    );
  }, [draw, drawDurationMs, onDrawComplete, startDelayMs]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: draw.value,
  }));

  const strokeW = Math.max(5.5, size * 0.09);

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <AnimatedPath
          d={CHECK_D}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${CHECK_PATH_LENGTH}`}
          animatedProps={pathProps}
        />
      </Svg>
    </View>
  );
}
