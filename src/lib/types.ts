export type Wallet = {
  id: string;
  name: string;
  is_shared: boolean;
  tracking_mode?: "full" | "basic" | null;
  split_mode?: "none" | "split" | null;
  default_split_method?: "equally" | "by_income" | "manual" | null;
  shared_option?: string | null;
  split_type?: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WalletMember = {
  id: string;
  wallet_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
};

export type Account = {
  id: string;
  wallet_id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  wallet_id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent_id: string | null;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  wallet_id: string;
  type: "income" | "expense" | "transfer";
  category_id: string;
  date: string;
  amount: number;
  account_from_id: string | null;
  account_to_id: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  user_id: string;
  wallet_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};
