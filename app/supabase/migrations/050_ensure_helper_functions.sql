-- Migration 050: Ensure all helper functions exist
-- Fixes "function public._anchor_day(date) does not exist" error
-- Created because migrations were deployed out of order on the server.

-- Helper: extract day from anchor_date
CREATE OR REPLACE FUNCTION public._anchor_day(p_anchor_date date)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN p_anchor_date IS NULL THEN NULL
              ELSE EXTRACT(day FROM p_anchor_date)::int
         END;
$$;

-- Helper: days in a month
CREATE OR REPLACE FUNCTION public._days_in_month(p_date date)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT EXTRACT(day FROM (date_trunc('month', p_date) + interval '1 month' - interval '1 day'))::int;
$$;

-- Helper: snap a date to the anchor month/day
CREATE OR REPLACE FUNCTION public._snap_to_anchor(
  p_target_date date,
  p_anchor_date date,
  p_snap_month boolean
) RETURNS date
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_target_year  int;
  v_target_month int;
  v_anchor_month int;
  v_anchor_day   int;
  v_month_start  date;
  v_max_day      int;
BEGIN
  IF p_anchor_date IS NULL THEN
    RETURN p_target_date;
  END IF;

  v_target_year  := EXTRACT(year FROM p_target_date)::int;
  v_target_month := EXTRACT(month FROM p_target_date)::int;
  v_anchor_month := EXTRACT(month FROM p_anchor_date)::int;
  v_anchor_day   := EXTRACT(day FROM p_anchor_date)::int;

  IF p_snap_month THEN
    v_month_start := make_date(v_target_year, v_anchor_month, 1);
    v_max_day     := EXTRACT(day FROM (v_month_start + interval '1 month' - interval '1 day'))::int;
    RETURN make_date(v_target_year, v_anchor_month, LEAST(v_anchor_day, v_max_day));
  ELSE
    v_month_start := make_date(v_target_year, v_target_month, 1);
    v_max_day     := EXTRACT(day FROM (v_month_start + interval '1 month' - interval '1 day'))::int;
    RETURN make_date(v_target_year, v_target_month, LEAST(v_anchor_day, v_max_day));
  END IF;
END;
$$;
