-- Migration: 062_unify_category_colors
-- Description: Unify all category colors to the deep shade (#1C1C1E) for consistency

UPDATE public.category_presets
SET color = '#1C1C1E';

UPDATE public.categories
SET color = '#1C1C1E';
