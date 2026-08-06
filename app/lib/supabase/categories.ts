import { supabase } from "./client";
import { createCategoriesApi } from "@shared/supabase/categories";
import type { Category, CategoryPreset } from "@shared/types";

const api = createCategoriesApi(supabase);

export const fetchCategoryPresets: typeof api.fetchCategoryPresets = api.fetchCategoryPresets;
export const fetchHouseholdCategories: typeof api.fetchHouseholdCategories = api.fetchHouseholdCategories;
export const createCategory: typeof api.createCategory = api.createCategory;
export const ensureHouseholdCategoryFromPreset: typeof api.ensureHouseholdCategoryFromPreset = api.ensureHouseholdCategoryFromPreset;

export type { Category, CategoryPreset };
