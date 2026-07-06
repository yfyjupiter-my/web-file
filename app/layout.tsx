import type { Metadata } from "next";
import "./globals.css";
import { ACTIVE_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Installer Vault",
  description: "Password-protected installer file repository for IT deployment.",
};

// Applies the persisted theme before first paint so switching to dark mode
// doesn't flash the default light theme on reload.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={ACTIVE_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
