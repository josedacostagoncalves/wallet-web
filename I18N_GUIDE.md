# Internationalization (i18n) Guide

## Overview

This application uses `next-intl` for internationalization. We support 4 languages:
- English (en)
- Portuguese (pt)
- Spanish (es)
- French (fr)

## How It Works

1. The user's preferred language is stored in the `profiles.language` column in the database
2. When a page loads, the i18n configuration (`src/i18n.ts`) fetches the user's profile and loads the appropriate translation file from the `messages/` directory
3. The `NextIntlClientProvider` in the root layout makes translations available throughout the app
4. When users change their language preference in Settings, the page refreshes to apply the new translations

## Using Translations

### In Server Components (async)

```tsx
import { getTranslations } from 'next-intl/server';

export default async function MyPage() {
  const t = await getTranslations('settings');
  
  return <h1>{t('title')}</h1>;
}
```

### In Client Components ("use client")

```tsx
"use client";
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('common');
  
  return <button>{t('save')}</button>;
}
```

### Translation Keys Structure

Translation files are organized by namespace. Example from `messages/en.json`:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "settings": {
    "title": "Settings",
    "language": "Language"
  }
}
```

Access with: `t('save')` when using `useTranslations('common')`

## Adding New Translations

1. Add the English text to `messages/en.json`
2. Add translations to `messages/pt.json`, `messages/es.json`, and `messages/fr.json`
3. Use the translation key in your components

Example:
```json
// messages/en.json
{
  "accounts": {
    "title": "Accounts",
    "addAccount": "Add Account"
  }
}
```

```tsx
// In your component
const t = await getTranslations('accounts');
return <h1>{t('title')}</h1>;
```

## Current Translation Coverage

The following sections currently have translations defined:
- `common`: Common actions (save, cancel, delete, edit, etc.)
- `auth`: Authentication-related text
- `dashboard`: Dashboard page
- `settings`: Settings page
- `language`: Language selector
- `accounts`: Accounts section
- `transactions`: Transactions section
- `wallets`: Wallets section
- `categories`: Categories section
- `reports`: Reports section
- `recurring`: Recurring transactions section

## Next Steps

To fully translate the application, you need to:

1. **Identify all hardcoded text strings** in your components
2. **Add them to the translation files** under appropriate namespaces
3. **Replace the hardcoded strings** with translation function calls

Example migration:
```tsx
// Before
<h1>My Transactions</h1>

// After
const t = await getTranslations('transactions');
<h1>{t('title')}</h1>
```

## Tips

- Keep translation keys descriptive: `addNewAccount` not `btn1`
- Group related translations under the same namespace
- For dynamic content, use variables:
  ```tsx
  t('welcomeMessage', { name: user.name })
  ```
  ```json
  { "welcomeMessage": "Welcome, {name}!" }
  ```
- Test language switching by changing the language in Settings
