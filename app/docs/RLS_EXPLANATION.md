# Row Level Security (RLS) Architecture

## Overview
The application uses a multi-tenant Household model. All data (Bills, Occurrences, Rules) is scoped to a Household, and users can belong to multiple households with different roles (`admin`, `editor`, `viewer`).

## Helper Functions
- `is_household_member(uuid)`: Verifies if the active `auth.uid()` has an `active` status in the given household.
- `household_role(uuid)`: Returns the role of the active user for the given household.

## Enforcement
- **Profiles:** Users can only select and update their own profile (`auth.uid() = id`).
- **Households & Members:** Any member can read. Only `admins` can update or manage roles.
- **Bills & Categories:** 
  - **Read:** Any `active` household member.
  - **Write (Insert/Update):** `admin` or `editor`.
  - **Delete:** `admin` only.
- **Bill Occurrences:** Permissions inherit from the parent `bill_id`. The policy uses an `EXISTS` subquery to join `bills` and check household membership.
- **Scheduled Reminders:** Read-only for users (using `EXISTS` through `bill_occurrences` and `bills`). The Edge Functions use the `service_role` key to bypass RLS and update/insert records into this queue.
- **Notification Log:** Read-only for the user `user_id = auth.uid()`. Written via Edge Functions.

## Verification
- **Anonymous users:** Blocked from all tables (no policies map to `anon` role).
- **Authenticated non-members:** Cannot read `bills` or `occurrences` because `is_household_member` returns false.
- **Viewers:** Can read bills, but `INSERT/UPDATE` fails the `admin or editor` role check.
- **Admins:** Can perform all operations including `DELETE`.
