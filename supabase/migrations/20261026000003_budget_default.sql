-- Default monthly AI budget: $25 -> $50 so a weekly run of ~20 prompts on all
-- four assistants (~$8-10/run) fits. Sites still on the old default move too.
alter table public.site_settings alter column monthly_ai_budget_usd set default 50.00;
update public.site_settings set monthly_ai_budget_usd = 50.00 where monthly_ai_budget_usd = 25.00;
