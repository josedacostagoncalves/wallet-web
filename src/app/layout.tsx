import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";

export const metadata: Metadata = {
  title: "J-Wallet",
  description: "Personal finance and shared wallets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
