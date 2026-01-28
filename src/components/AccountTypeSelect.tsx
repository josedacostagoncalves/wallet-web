"use client";

import { ACCOUNT_TYPES, type AccountType } from "@/lib/account-types";

type Props = {
  value: AccountType;
  onChange: (value: AccountType) => void;
  id?: string;
  required?: boolean;
};

export function AccountTypeSelect({
  value,
  onChange,
  id = "account-type-select",
  required = true,
}: Props) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" htmlFor={id}>
        Type *
      </label>
      <select
        id={id}
        name="account_type"
        value={value}
        onChange={(e) => onChange(e.target.value as AccountType)}
        required={required}
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800"
      >
        {ACCOUNT_TYPES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
