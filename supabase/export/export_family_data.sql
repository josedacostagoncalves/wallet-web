-- Export one family's J-Wallet data as a single JSON document.
-- Run in Supabase → SQL Editor. Edit ONLY the three emails below, run, then download the result.
--
-- Picks every wallet whose logged-in members are all in the list (personal wallets of each
-- person + wallets shared only between them). Wallets that include anyone else are skipped.
-- Does NOT export passwords: everyone signs up again on the new project with the same email.

with family_emails(email) as (
  values ('person1@example.com'), ('person2@example.com'), ('person3@example.com')
),
family_users as (
  select u.id, u.email from auth.users u join family_emails f on lower(f.email) = lower(u.email)
),
fam_wallets as (
  select wm.wallet_id as id
  from public.wallet_members wm
  left join auth.users u on u.id = wm.user_id
  group by wm.wallet_id
  -- every member with a login is family (placeholder members without a login are fine) …
  having bool_and(u.id is null or u.id in (select id from family_users))
  -- … and at least one family login is a member
     and bool_or(u.id in (select id from family_users))
),
fam_tx as (
  select id from public.transactions where wallet_id in (select id from fam_wallets)
),
fam_member_ids as (
  select distinct user_id as id from public.wallet_members where wallet_id in (select id from fam_wallets)
)
select json_build_object(
  'format', 'jwallet-family-export-v1',
  'exported_at', now(),
  'users', (select coalesce(json_agg(json_build_object('id', id, 'email', email)), '[]') from family_users),
  'wallets', (select coalesce(json_agg(t), '[]') from public.wallets t where id in (select id from fam_wallets)),
  'wallet_members', (select coalesce(json_agg(t), '[]') from public.wallet_members t where wallet_id in (select id from fam_wallets)),
  'profiles', (select coalesce(json_agg(t), '[]') from public.profiles t where id in (select id from fam_member_ids)),
  'accounts', (select coalesce(json_agg(t), '[]') from public.accounts t where wallet_id in (select id from fam_wallets)),
  'categories', (select coalesce(json_agg(t), '[]') from public.categories t where wallet_id in (select id from fam_wallets)),
  'recurring_rules', (select coalesce(json_agg(t), '[]') from public.recurring_rules t where wallet_id in (select id from fam_wallets)),
  'transactions', (select coalesce(json_agg(t), '[]') from public.transactions t where id in (select id from fam_tx)),
  'transaction_splits', (select coalesce(json_agg(t), '[]') from public.transaction_splits t where transaction_id in (select id from fam_tx)),
  'transaction_attachments', (select coalesce(json_agg(t), '[]') from public.transaction_attachments t where transaction_id in (select id from fam_tx)),
  'user_preferences', (select coalesce(json_agg(t), '[]') from public.user_preferences t
                       where user_id in (select id from family_users)
                         and (wallet_id is null or wallet_id in (select id from fam_wallets)))
) as export;
