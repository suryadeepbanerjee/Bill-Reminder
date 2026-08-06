import { supabase } from "../supabase";
import { createRemindersApi, defaultReminderRules } from "@shared/supabase/reminders";

const api = createRemindersApi(supabase);

export const fetchReminderRules = api.fetchReminderRules;
export const createReminderRule = api.createReminderRule;
export const updateReminderRule = api.updateReminderRule;
export const deleteReminderRule = api.deleteReminderRule;
export const toggleReminderRule = api.toggleReminderRule;

export { defaultReminderRules };
