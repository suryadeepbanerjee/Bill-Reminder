import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

interface SkeletonBoxProps {
  className?: string;
  style?: object;
}

function SkeletonBox({ className = "", style }: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue:         1,
          duration:        800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue:         0.3,
          duration:        800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={`bg-border rounded-sm ${className}`}
      style={[{ opacity }, style]}
    />
  );
}

/** A single bill card skeleton */
function BillCardSkeleton() {
  return (
    <View className="bg-surface border border-border rounded-card p-4 mb-3">
      <View className="flex-row items-center gap-3">
        <SkeletonBox className="w-10 h-10 rounded-input" />
        <View className="flex-1 gap-2">
          <SkeletonBox className="h-4 rounded-sm w-3/4" />
          <SkeletonBox className="h-3 rounded-sm w-1/2" />
        </View>
        <View className="items-end gap-2">
          <SkeletonBox className="h-4 w-16 rounded-sm" />
          <SkeletonBox className="h-3 w-12 rounded-sm" />
        </View>
      </View>
    </View>
  );
}

/** A section header skeleton */
function SectionSkeleton() {
  return (
    <View className="mb-4">
      <SkeletonBox className="h-3 w-20 rounded-sm mb-3" />
      <BillCardSkeleton />
      <BillCardSkeleton />
    </View>
  );
}

interface LoadingSkeletonProps {
  variant?: "list" | "dashboard" | "detail";
  count?: number;
}

export function LoadingSkeleton({ variant = "list", count = 3 }: LoadingSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <View className="p-4 gap-6">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </View>
    );
  }

  if (variant === "detail") {
    return (
      <View className="p-4 gap-4">
        {/* Hero area */}
        <View className="bg-surface border border-border rounded-card p-6 items-center gap-3">
          <SkeletonBox className="w-14 h-14 rounded-full" />
          <SkeletonBox className="h-6 w-2/3 rounded-sm" />
          <SkeletonBox className="h-8 w-1/3 rounded-sm" />
          <SkeletonBox className="h-4 w-1/2 rounded-sm" />
        </View>
        {/* Details */}
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} className="flex-row justify-between py-3 border-b border-border">
            <SkeletonBox className="h-4 w-1/3 rounded-sm" />
            <SkeletonBox className="h-4 w-1/4 rounded-sm" />
          </View>
        ))}
      </View>
    );
  }

  // Default list
  return (
    <View className="p-4">
      {Array.from({ length: count }).map((_, i) => (
        <BillCardSkeleton key={i} />
      ))}
    </View>
  );
}
