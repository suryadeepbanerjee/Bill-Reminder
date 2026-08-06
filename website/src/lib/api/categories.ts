import { supabase } from "../supabase";
import { createCategoriesApi } from "@shared/supabase/categories";

const api = createCategoriesApi(supabase);

export const fetchCategoryPresets = api.fetchCategoryPresets;
export const fetchHouseholdCategories = api.fetchHouseholdCategories;
export const createCategory = api.createCategory;
export const ensureHouseholdCategoryFromPreset = api.ensureHouseholdCategoryFromPreset;
