import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automata Protocol V6 | Cyber Dashboard",
  description: "Real-time blockchain notarization monitoring for 20 OLT devices on IOTA Rebased Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
