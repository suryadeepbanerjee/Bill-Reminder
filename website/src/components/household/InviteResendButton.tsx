import { memo, useEffect, useState, useCallback } from "react";
import { getInviteResendState, formatWaitMs } from "../../lib/invite-resend";
import type { HouseholdMember } from "../../lib/types";

type Props = {
  member: HouseholdMember;
  onResend: () => void;
  disabled?: boolean;
};

function InviteResendButtonInner({ member, onResend, disabled }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [sending, setSending] = useState(false);

  const state = getInviteResendState(member.invite_count ?? 1, member.invite_last_sent_at, now);
  const needsTick = state.stage === "cooldown" || state.stage === "lockout";

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  const handleClick = useCallback(async () => {
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
      <span className="text-xs text-secondary font-medium whitespace-nowrap">
        Resend in {formatWaitMs(state.remainingMs)}
      </span>
    );
  }

  if (state.stage === "lockout") {
    return (
      <span className="text-xs text-error/80 font-medium whitespace-nowrap">
        Too many invites · try again in {formatWaitMs(state.remainingMs)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || sending}
      className={`ml-2 bg-accent/10 px-3 py-1.5 rounded-full text-xs text-accent font-semibold hover:bg-accent/20 transition-colors shrink-0 disabled:opacity-50 ${
        sending ? "opacity-60" : ""
      }`}
    >
      {sending ? "Sending…" : "Resend"}
    </button>
  );
}

export const InviteResendButton = memo(InviteResendButtonInner);