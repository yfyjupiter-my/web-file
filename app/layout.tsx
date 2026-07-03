import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Installer Vault",
  description: "Password-protected installer file repository for IT deployment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="sunset">
      <body>{children}</body>
    </html>
  );
}
