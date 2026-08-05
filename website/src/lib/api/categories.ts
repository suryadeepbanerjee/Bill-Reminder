import { supabase } from "../supabase";
import type { Category, CategoryPreset } from "../types";

export async function fetchCategoryPresets(): Promise<CategoryPreset[]> {
  const { data, error } = await supabase
    .from("category_presets")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryPreset[];
}

export async function fetchHouseholdCategories(householdId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

export async function createCategory(input: {
  household_id: string;
  name:         string;
  icon:         string;
  color:        string;
  preset_key?:  string | null;
}): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Category;
}

/** Ensures a household category exists for the preset, else creates it. */
export async function ensureHouseholdCategoryFromPreset(
  householdId: string,
  preset:      CategoryPreset
): Promise<Category> {
  const { data: existing } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .eq("preset_key", preset.key)
    .maybeSingle();

  if (existing) return existing as Category;

  return createCategory({
    household_id: householdId,
    name:         preset.name,
    icon:         preset.icon,
    color:        preset.color,
    preset_key:   preset.key,
  });
}