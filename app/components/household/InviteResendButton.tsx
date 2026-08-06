import { memo, useEffect, useState, useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { getInviteResendState, formatWaitMs } from "@shared/utils/invite-resend";
import type { HouseholdMember } from "@shared/types";

type Props = {
  member: HouseholdMember;
  onResend: () => void;
  disabled?: boolean;
};

function InviteResendButtonInner({ member, onResend, disabled }: Props) {
  const [now, setNow] = useState(Date.now());
  const [sending, setSending] = useState(false);

  const tick = useCallback(() => setNow(Date.now()), []);
  const state = getInviteResendState(member.invite_count ?? 1, member.invite_last_sent_at, now);

  const needsTick = state.stage === "cooldown" || state.stage === "lockout";

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [needsTick, tick]);

  const handlePress = useCallback(async () => {
    if (disabled || sending) return;
    setSending(true);
    try {
      await onResend();
    } finally {
      setSending(false);
      setNow(Date.now());
    }
  }, [disabled, sending, onResend]);

  if (state.stage === "cooldown") {
    return (
      <Text className="text-[11px] text-secondary">
        Resend in {formatWaitMs(state.remainingMs)}
      </Text>
    );
  }

  if (state.stage === "lockout") {
    return (
      <View className="items-end">
        <Text className="text-[11px] text-error/80">Too many invites</Text>
        <Text className="text-[11px] text-error/80">Try again in {formatWaitMs(state.remainingMs)}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      disabled={disabled || sending}
      className="bg-accent/10 px-3 py-1.5 rounded-full"
    >
      <Text className={`text-[12px] text-accent font-semibold ${sending ? "opacity-60" : ""}`}>
        {sending ? "Sending…" : "Resend"}
      </Text>
    </Pressable>
  );
}

export const InviteResendButton = memo(InviteResendButtonInner);