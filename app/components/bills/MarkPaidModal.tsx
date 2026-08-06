/**
 * MarkPaidModal — shared "Mark as paid" bottom sheet.
 *
 * Behaviour:
 *  - Variable bill  (amount_expected === null AND occurrence.amount === null):
 *      Amount field is mandatory (empty → validation error, can't confirm).
 *      Notes are optional as usual.
 *  - Fixed bill:
 *      Amount field is pre-filled with the expected value; user may change it.
 *      Notes are optional as usual.
 */
import { useState, useEffect } from "react";
import { View, Text, Switch, TouchableOpacity, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";

import { Modal }       from "../ui/Modal";
import { TextInput }   from "../ui/TextInput";
import { Button }      from "../ui/Button";
import { AlertBadge }  from "../ui/AlertBadge";
import { DateAnchorPicker } from "../ui/DateAnchorPicker";
import { useMarkPaid } from "../../hooks/useOccurrences";
import { humanize }    from "@shared/utils/errors";
import type { BillOccurrence } from "@shared/types";

export interface MarkPaidTarget {
  /** The occurrence being paid */
  occurrence:    BillOccurrence;
  /** Bill title shown in the header */
  billTitle:     string;
  /** Expected amount — null means this is a variable bill */
  amountExpected: number | null;
  /** The behavior type of the bill (e.g., 'fixed_due_date', 'prepaid_validity', 'wallet_balance') */
  behaviorType?:  string;
}

interface MarkPaidModalProps {
  target:    MarkPaidTarget | null;   // null = closed
  onClose:   () => void;
  onSuccess?: (occurrenceId: string) => void;
}

export function MarkPaidModal({ target, onClose, onSuccess }: MarkPaidModalProps) {
  const isVariable = target
    ? (target.amountExpected == null && (target.occurrence.amount ?? null) == null)
    : false;

  const defaultAmount = target
    ? String(target.occurrence.amount ?? target.amountExpected ?? "")
    : "";

  const [amount, setAmount] = useState(defaultAmount);
  const [notes,  setNotes]  = useState("");
  const [error,  setError]  = useState<string | null>(null);

  // Date selection
  const [paidToday, setPaidToday] = useState(true);
  const [paidMonth, setPaidMonth] = useState(new Date().getMonth() + 1);
  const [paidDay, setPaidDay] = useState(new Date().getDate());
  const [paidYear, setPaidYear] = useState(new Date().getFullYear());
  const [shiftAnchor, setShiftAnchor] = useState(false);

  const canShiftAnchor = target?.behaviorType === "prepaid_validity" || target?.behaviorType === "wallet_balance";

  const { mutateAsync, isPending } = useMarkPaid();

  // Re-initialise when a new target is opened
  useEffect(() => {
    if (target) {
      setAmount(
        target.occurrence.amount != null
          ? String(target.occurrence.amount)
          : target.amountExpected != null
          ? String(target.amountExpected)
          : ""
      );
      setNotes("");
      setError(null);
      setPaidToday(true);
      const now = new Date();
      setPaidMonth(now.getMonth() + 1);
      setPaidDay(now.getDate());
      setPaidYear(now.getFullYear());
      setShiftAnchor(false);
    }
  }, [target?.occurrence.id]);

  const handleConfirm = async () => {
    const parsed = parseFloat(amount);

    if (!amount.trim() || isNaN(parsed) || parsed < 0) {
      setError(
        "Please enter a valid amount."
      );
      return;
    }

    if (!paidToday && (!paidMonth || !paidDay || !paidYear)) {
      setError("Please select the date you paid.");
      return;
    }

    let paidAtIso = new Date().toISOString();
    if (!paidToday) {
      const d = new Date(paidYear, paidMonth - 1, paidDay, 12, 0, 0); // Noon to avoid timezone issues
      paidAtIso = d.toISOString();
    }

    setError(null);
    try {
      await mutateAsync({
        occurrence_id:  target!.occurrence.id,
        paid_amount:    parsed,
        paid_at:        paidAtIso,
        payment_notes:  notes.trim() || null,
        shift_anchor_to_payment: shiftAnchor,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.(target!.occurrence.id);
      onClose();
    } catch (e: any) {
      setError(e?.message || JSON.stringify(e));
    }
  };

  return (
    <Modal visible={target !== null} onClose={onClose} variant="bottom">
      <ScrollView 
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="gap-0.5">
          <Text className="text-title text-primary font-semibold">
            Mark as paid
          </Text>
          {target && (
            <Text className="text-caption text-secondary" numberOfLines={1}>
              {target.billTitle}
              {isVariable ? "  ·  Variable amount" : ""}
            </Text>
          )}
        </View>

        {/* Inline error */}
        {!!error && <AlertBadge message={error} variant="error" />}

        {/* Amount field */}
        <TextInput
          label={isVariable ? "Amount paid  *" : "Amount paid"}
          value={amount}
          onChangeText={(t) => {
            setAmount(t);
            if (error) setError(null);
          }}
          keyboardType="decimal-pad"
          returnKeyType="next"
          leadingIcon={
            <Text className="text-body text-secondary font-medium">₹</Text>
          }
          hint={
            isVariable
              ? "Required — enter the exact amount charged this cycle"
              : "Pre-filled with the expected amount"
          }
        />

        {/* Date of payment */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-body text-primary font-medium">Paid today?</Text>
            </View>
            <Switch
              value={paidToday}
              onValueChange={(val) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPaidToday(val);
                if (val) {
                  const now = new Date();
                  setPaidMonth(now.getMonth() + 1);
                  setPaidDay(now.getDate());
                  setPaidYear(now.getFullYear());
                }
              }}
              trackColor={{ false: "#3F3F46", true: "#EAB308" }}
              thumbColor={"#FFFFFF"}
            />
          </View>

          {!paidToday && (
            <DateAnchorPicker
              showMonth
              showDay
              showYear
              month={paidMonth}
              day={paidDay}
              year={paidYear}
              onMonthChange={setPaidMonth}
              onDayChange={setPaidDay}
              onYearChange={setPaidYear}
              dateLabel="Payment date"
            />
          )}
        </View>

        {/* Shift Anchor Option (only for prepaid/wallet bills) */}
        {canShiftAnchor && (
          <View className="gap-2">
            <Text className="text-body text-primary font-medium">Calculate next due date from:</Text>
            <View className="bg-surface-elevated rounded-xl overflow-hidden">
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShiftAnchor(false);
                }}
                className={`p-4 flex-row items-center border-b border-surface-divider`}
              >
                <View className="flex-1">
                  <Text className="text-body text-primary font-medium">Original due date</Text>
                  <Text className="text-caption text-secondary mt-0.5">Keeps the original billing cycle</Text>
                </View>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${!shiftAnchor ? "border-accent" : "border-surface-divider"}`}>
                  {!shiftAnchor && <View className="w-2.5 h-2.5 rounded-full bg-accent" />}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setShiftAnchor(true);
                }}
                className={`p-4 flex-row items-center`}
              >
                <View className="flex-1">
                  <Text className="text-body text-primary font-medium">Date of payment</Text>
                  <Text className="text-caption text-secondary mt-0.5">Shifts the cycle to start from payment</Text>
                </View>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${shiftAnchor ? "border-accent" : "border-surface-divider"}`}>
                  {shiftAnchor && <View className="w-2.5 h-2.5 rounded-full bg-accent" />}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Notes (always optional) */}
        <TextInput
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Payment reference, transaction ID…"
          multiline
          numberOfLines={2}
          maxCharacters={1000}
        />

        {/* Actions */}
        <View className="flex-row gap-3 mt-2">
          <View className="flex-1">
            <Button title="Cancel" variant="secondary" onPress={onClose} fullWidth />
          </View>
          <View className="flex-1">
            <Button
              title="Confirm payment"
              variant="accent"
              onPress={handleConfirm}
              loading={isPending}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}
