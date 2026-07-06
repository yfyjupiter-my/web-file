import type { Metadata } from "next";
import "./globals.css";
import { ACTIVE_THEME } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Installer Vault",
  description: "Password-protected installer file repository for IT deployment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={ACTIVE_THEME}>
      <body>{children}</body>
    </html>
  );
}
