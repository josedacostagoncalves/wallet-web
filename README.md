# Wallet JJ

Personal finance and shared wallets: income, expenses, transfers, accounts, categories, and activity log.

## Stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase**: PostgreSQL, Auth, RLS
- **Recharts** for dashboard charts

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy:
   - **Project URL**
   - **anon public** key
3. In the **SQL Editor**, run (in this order):  
   - `supabase/migrations/001_initial.sql` (tables, RLS, indexes, triggers)  
   - `supabase/migrations/002_create_wallet_rpc.sql` (RPC for creating wallets)

### 2. Env

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` = your Project URL  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key  

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. First use

1. **Sign up** with email/password.
2. **Create a wallet** (Wallets → Create wallet).
3. **Add accounts** (e.g. Cash, Bank 1).
4. **Add categories** (e.g. Income: Salary, Sales; Expense: Groceries, Streaming; subcategories as needed).
5. **Add movements** from Home → New movement.

## Deploy (Vercel) — run online and use from any device

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on [GitHub](https://github.com/new), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. **Add New** → **Project** → import your GitHub repo.
3. **Environment Variables** (add these before deploying):
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase **Project URL**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase **anon** key  
   - *(Optional)* `SUPABASE_SERVICE_ROLE_KEY` = your **service_role** key (needed for wallet member emails in shared wallets).
4. Click **Deploy**.

Vercel will build and host the app. You’ll get a URL like `https://your-app.vercel.app` — use it from any device.

### 3. Supabase auth URLs (required for login)

After the first deploy:

1. **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**.
2. Set **Site URL** to `https://your-app.vercel.app` (use your real Vercel URL).
3. Under **Redirect URLs**, add `https://your-app.vercel.app/**`.

Without this, login/signup and email confirmation can fail in production.

### 4. Custom domain (optional)

In your Vercel project: **Settings** → **Domains** → add your domain. Then add the same domain to Supabase **Redirect URLs** and **Site URL**.

---

## Supabase migrations

Run in the **SQL Editor** (Supabase Dashboard), in order:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_create_wallet_rpc.sql`
3. `supabase/migrations/003_add_share_code_to_wallets.sql`
4. `supabase/migrations/004_recurring_and_pending.sql` (recurring rules, transaction status, pending movements)
5. `supabase/migrations/005_work_day_recurrence.sql` (work day recurrence: nth / nth last work day of month)
6. `supabase/migrations/006_interval_days.sql` (every X days recurrence, `interval_days` column)
7. `supabase/migrations/007_account_type.sql` (account type: bank_account, cash, credit_card, savings, investments)
