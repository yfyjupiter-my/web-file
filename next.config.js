/** @type {import('next').NextConfig} */

// Applied to every response (SEC-5). Clickjacking + MIME-sniff + referrer
// leakage defenses. CSP here is limited to frame-ancestors; a full
// script/style CSP can be layered in once asset origins are known.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig = {
  // Enables instrumentation.ts (boot-time env validation, SEC-3).
  experimental: { instrumentationHook: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
