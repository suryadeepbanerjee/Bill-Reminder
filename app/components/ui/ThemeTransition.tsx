import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { useThemeStore } from "../../stores/theme-store";
import { tokensFor } from "../../lib/tokens";

/**
 * Gentle theme crossfade.
 *
 * Phase 1 — the veil rises from transparent to opaque in the *outgoing*
 * canvas color (invisible at start, since the screen still shows that theme;
 * content dissolves softly into a plain surface).
 * Phase 2 — at full cover the store applies the new theme: CSS variables,
 * tab bar and native headers all swap behind an opaque mask, so the staggered
 * native vs. JS paint can never be seen.
 * Phase 3 — the veil switches to the *incoming* canvas color (pixel-identical
 * to what's underneath) and fades away, dissolving the new theme into view.
 *
 * Fast (~420ms total) and gentle — no hard flash, no sudden solid screen.
 * pointerEvents="none" keeps the app fully interactive while fading.
 */
const RISE_MS = 200;
const FALL_MS = 240;

export function ThemeTransition() {
  const mode = useThemeStore((s) => s.mode);
  const resolved = useThemeStore((s) => s.resolved);
  const applyResolved = useThemeStore((s) => s.applyResolved);

  const opacity = useRef(new Animated.Value(0)).current;
  const [fill, setFill] = useState<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (mode === resolved || running.current) return;

    const target = mode;
    const fromCanvas = tokensFor(resolved).canvas;
    running.current = true;

    const run = async () => {
      try {
        // Phase 1 — veil rises over the outgoing theme.
        setFill(fromCanvas);
        opacity.setValue(0);
        await animate(opacity, 1, RISE_MS);

        // Phase 2 — swap everything underneath at full cover.
        applyResolved(target);
        setFill(tokensFor(target).canvas);

        // Phase 3 — veil fades away, revealing the new theme.
        await animate(opacity, 0, FALL_MS);
        setFill(null);
      } finally {
        running.current = false;
      }
    };
    run();
  }, [mode, resolved, opacity, applyResolved]);

  if (fill === null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: fill, opacity }]}
    />
  );
}

function animate(value: Animated.Value, toValue: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    Animated.timing(value, {
      toValue,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => resolve());
  });
}