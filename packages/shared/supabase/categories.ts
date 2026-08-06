import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, CategoryPreset } from "../types";

export interface CategoriesApi {
  fetchCategoryPresets(): Promise<CategoryPreset[]>;
  fetchHouseholdCategories(householdId: string): Promise<Category[]>;
  createCategory(input: {
    household_id: string;
    name:         string;
    icon:         string;
    color:        string;
    preset_key?:  string | null;
  }): Promise<Category>;
  ensureHouseholdCategoryFromPreset(
    householdId: string,
    preset:      CategoryPreset
  ): Promise<Category>;
}

/** Client-bound categories data layer. Each platform binds its own client. */
export function createCategoriesApi(supabase: SupabaseClient): CategoriesApi {
  const fetchCategoryPresets = async (): Promise<CategoryPreset[]> => {
    const { data, error } = await supabase
      .from("category_presets")
      .select("*")
      .order("name");

    if (error) throw new Error(error.message);
    return (data ?? []) as CategoryPreset[];
  };

  const fetchHouseholdCategories = async (householdId: string): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("name");

    if (error) throw new Error(error.message);
    return (data ?? []) as Category[];
  };

  const createCategory = async (input: {
    household_id: string;
    name:         string;
    icon:         string;
    color:        string;
    preset_key?:  string | null;
  }): Promise<Category> => {
    const { data, error } = await supabase
      .from("categories")
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Category;
  };

  const ensureHouseholdCategoryFromPreset = async (
    householdId: string,
    preset:      CategoryPreset
  ): Promise<Category> => {
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
  };

  return {
    fetchCategoryPresets,
    fetchHouseholdCategories,
    createCategory,
    ensureHouseholdCategoryFromPreset,
  };
}
