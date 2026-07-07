/** @type {import('next').NextConfig} */

// Applied to every response (SEC-5). Clickjacking + MIME-sniff + referrer
// leakage defenses. CSP here is limited to frame-ancestors; a full
// script/style CSP can be layered in once asset origins are known.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app never needs these browser capabilities; deny them outright.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

// P4.9 — the Supabase project host, so next/image can optimize signed thumbnail
// URLs from Storage once downloads land. Derived from SUPABASE_URL when set.
const supabaseHost = (() => {
  try {
    return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig = {
  // P4.9 — self-contained server output (minimal node_modules) for container/
  // serverless deploys; pays off now that a real backend (Supabase) is wired in.
  output: "standalone",
  // instrumentation.ts (boot-time env validation, SEC-3) is stable in Next 15+;
  // no experimental flag needed.
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/**" }]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
