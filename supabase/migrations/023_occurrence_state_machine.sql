-- Migration: 023_occurrence_state_machine
-- Description: Creates function to transition bill_occurrences through states based on dates
-- Transitions: upcoming → due_today → overdue

create or replace function public.transition_bill_occurrences()
returns integer
language plpgsql
security definer
as $$
declare
  total integer := 0;
  n     integer;
  today_date date := current_date;
begin
  -- Transition: upcoming/generated → due_today (when due_date = today)
  update public.bill_occurrences
  set state = 'due_today',
      updated_at = now()
  where state in ('upcoming', 'generated')
    and due_date = today_date;

  get diagnostics n = ROW_COUNT;
  total := total + n;

  -- Transition: upcoming/generated/due_today → overdue (when due_date < today)
  update public.bill_occurrences
  set state = 'overdue',
      updated_at = now()
  where state in ('upcoming', 'generated', 'due_today')
    and due_date < today_date;

  get diagnostics n = ROW_COUNT;
  total := total + n;

  return total;
end;
$$;

-- Create a cron job to run the state machine every hour
select cron.schedule(
  'occurrence-state-machine',
  '0 * * * *',
  $$select public.transition_bill_occurrences()$$
);
