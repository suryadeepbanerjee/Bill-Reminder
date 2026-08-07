import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../stores/theme-store";
import { tokensFor } from "../../lib/tokens";

/**
 * Theme-switch buffer screen.
 *
 * When the user toggles the theme this full-screen veil covers the app with
 * a small, quiet scene — a sun/moon mark in a soft accent disc with a thin
 * progress shimmer sweeping below it — then swaps every themed surface
 * (CSS variables, tab bar, native headers) behind the opaque cover and
 * dissolves away, revealing the new theme with no staggered paint.
 *
 * Phases:
 *   1. Rise   (320ms) — veil eases up in the *outgoing* canvas; the mark
 *      springs in. Invisible at start because the screen is still that theme.
 *   2. Buffer (720ms) — held at full cover. The shimmer sweeps twice with a
 *      beat between; the theme swap fires mid-buffer, so the whole app
 *      changes theme *in the background* and settles while the cover is still
 *      up — the reveal then lands on a fully-painted app.
 *   3. Reveal (380ms) — veil eases out, mark drifts up and away, and the new
 *      theme has long finished painting underneath.
 *
 * Touches are blocked while the veil is visible (deliberate buffer, ~1.4s
 * total) so a mid-swap tap can't queue a second toggle.
 */
const RISE_MS   = 320;
const BUFFER_MS = 760;
const FALL_MS   = 380;
const SWEEP_MS  = 300;
const BAR_WIDTH = 148;
const BAR_HEIGHT = 3;

export function ThemeTransition() {
  const mode = useThemeStore((s) => s.mode);
  const resolved = useThemeStore((s) => s.resolved);
  const applyResolved = useThemeStore((s) => s.applyResolved);

  const veilOpacity = useRef(new Animated.Value(0)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale   = useRef(new Animated.Value(0.9)).current;
  const barX        = useRef(new Animated.Value(-BAR_WIDTH)).current;

  const running = useRef(false);
  const [fill, setFill] = useState<string | null>(null);
  const [shownTheme, setShownTheme] = useState<"light" | "dark">(resolved);

  useEffect(() => {
    if (mode === resolved || running.current) return;

    const target = mode;
    running.current = true;

    const run = async () => {
      try {
        // Prepare on the outgoing theme.
        setShownTheme(resolved);
        setFill(tokensFor(resolved).canvas);
        veilOpacity.setValue(0);
        markOpacity.setValue(0);
        markScale.setValue(0.9);
        barX.setValue(-BAR_WIDTH);

        // Phase 1 — the buffer rises over the outgoing theme.
        await parallel([
          timing(veilOpacity, 1, RISE_MS, Easing.out(Easing.cubic)),
          timing(markOpacity, 1, RISE_MS, Easing.out(Easing.cubic)),
          spring(markScale, 1),
        ]);

        // Phase 2 — buffer: theme changes *in the background* under cover.
        // Sweep 1 → swap → beat → sweep 2, so the new palette has time to
        // settle on every surface before the veil ever lifts.
        const breathe = () =>
          Animated.sequence([
            timing(markScale, 1.05, 140, Easing.out(Easing.quad)),
            timing(markScale, 1, 140, Easing.in(Easing.quad)),
          ]);

        await parallel([
          timing(barX, 0, SWEEP_MS, Easing.inOut(Easing.cubic)),
          breathe(),
        ]);

        applyResolved(target);
        setShownTheme(target);
        setFill(tokensFor(target).canvas);

        await delay(120);

        barX.setValue(-BAR_WIDTH);
        await parallel([
          timing(barX, 0, SWEEP_MS, Easing.inOut(Easing.cubic)),
          breathe(),
        ]);

        // Phase 3 — dissolve, revealing the fully-swapped theme.
        await parallel([
          timing(veilOpacity, 0, FALL_MS, Easing.out(Easing.cubic)),
          timing(markOpacity, 0, FALL_MS, Easing.out(Easing.cubic)),
          timing(markScale, 1.07, FALL_MS, Easing.in(Easing.cubic)),
        ]);
        setFill(null);
      } finally {
        running.current = false;
      }
    };

    run();
  }, [mode, resolved, veilOpacity, markOpacity, markScale, barX, applyResolved]);

  if (fill === null) return null;

  const c = tokensFor(shownTheme);
  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, { backgroundColor: fill, opacity: veilOpacity }]}
    >
      <Animated.View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          opacity: markOpacity,
          transform: [{ scale: markScale }],
        }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: `${c.accent}1F`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={shownTheme === "dark" ? "moon" : "sunny"}
            size={44}
            color={c.accent}
          />
        </View>
        <View
          style={{
            marginTop: 26,
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            borderRadius: 2,
            backgroundColor: c.border,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: BAR_WIDTH,
              height: BAR_HEIGHT,
              borderRadius: 2,
              backgroundColor: c.accent,
              transform: [{ translateX: barX }],
            }}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function timing(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing: (t: number) => number
) {
  return Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });
}

function spring(value: Animated.Value, toValue: number) {
  return Animated.spring(value, { toValue, speed: 14, bounciness: 5, useNativeDriver: true });
}

function parallel(animations: Animated.CompositeAnimation[]): Promise<void> {
  return new Promise((resolve) => Animated.parallel(animations).start(() => resolve()));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
