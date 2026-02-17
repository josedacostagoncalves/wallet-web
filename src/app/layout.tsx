import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export const metadata: Metadata = {
  title: "J-Wallet",
  description: "Personal finance and shared wallets",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
