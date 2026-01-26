import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallet JJ",
  description: "Personal finance and shared wallets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
