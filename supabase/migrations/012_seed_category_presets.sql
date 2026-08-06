-- Migration: 012_seed_category_presets
-- Description: Seed category_presets with standard categories

insert into public.category_presets (key, name, icon, color) values
  ('credit_card', 'Credit Card', 'credit-card', '#1C1C1E'),
  ('mobile_recharge', 'Mobile Recharge', 'smartphone', '#525252'),
  ('broadband', 'Broadband', 'wifi', '#404040'),
  ('electricity', 'Electricity', 'zap', '#737373'),
  ('water', 'Water', 'droplets', '#A3A3A3'),
  ('gas', 'Gas', 'flame', '#D4D4D4'),
  ('insurance', 'Insurance', 'shield', '#1C1C1E'),
  ('emi', 'EMI', 'calendar', '#525252'),
  ('rent', 'Rent', 'home', '#404040'),
  ('loan', 'Loan', 'landmark', '#737373'),
  ('ott', 'OTT', 'tv', '#A3A3A3'),
  ('music', 'Music', 'music', '#D4D4D4'),
  ('cloud_services', 'Cloud Services', 'cloud', '#1C1C1E'),
  ('hosting', 'Hosting', 'server', '#525252'),
  ('domain', 'Domain', 'globe', '#404040'),
  ('education', 'Education', 'book-open', '#737373'),
  ('gym', 'Gym', 'dumbbell', '#A3A3A3'),
  ('health', 'Health', 'heart-pulse', '#D4D4D4'),
  ('investments', 'Investments', 'trending-up', '#1C1C1E'),
  ('subscriptions', 'Subscriptions', 'repeat', '#525252'),
  ('other', 'Other', 'layers', '#404040')
on conflict (key) do nothing;
