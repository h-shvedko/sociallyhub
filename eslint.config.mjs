import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ADR-0003: the only permitted auth import surface in application code is
// '@/lib/auth'. The entries below ban the legacy/broken paths that caused
// five-way import drift. See ADR/ADR-0003-auth-helpers-and-route-conventions.md.
const restrictedAuthImportPaths = [
  {
    name: "@/lib/auth/utils",
    message:
      "Module does not exist. Import from '@/lib/auth' instead (ADR-0003).",
  },
  {
    name: "@/lib/auth-utils",
    message:
      "Module does not exist. Import from '@/lib/auth' instead (ADR-0003).",
  },
  {
    name: "@/lib/auth/auth-options",
    message:
      "Deleted shim. Import { authOptions } from '@/lib/auth' instead (ADR-0003).",
  },
  {
    name: "@/lib/auth/demo-user",
    message:
      "Internal to the auth module. Use getAuthenticatedUser()/requireSession() from '@/lib/auth' instead (ADR-0003; removal tracked by ADR-0025).",
  },
  {
    name: "@/lib/auth/config",
    message:
      "Import { authOptions } from '@/lib/auth' instead (ADR-0003). Only src/lib/auth/** and the [...nextauth] route may import the config directly.",
  },
  {
    name: "@/lib/utils",
    importNames: ["normalizeUserId"],
    message:
      "'@/lib/utils' does not export normalizeUserId. Use getAuthenticatedUser()/requireSession() from '@/lib/auth' (ADR-0003).",
  },
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  // ADR-0003 Phase 3.3 — ban legacy auth import paths everywhere...
  {
    rules: {
      "no-restricted-imports": ["error", { paths: restrictedAuthImportPaths }],
    },
  },
  // ADR-0003 — discourage (WARN, not error) the legacy auth surface in app
  // code so NEW usage is flagged without breaking lint on the hundreds of
  // legacy call sites that are migrated in phases. Uses the typescript-eslint
  // variant of the rule so these warn-level entries can coexist with the
  // error-level bans above (a single rule id cannot mix severities).
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "next-auth",
              importNames: ["getServerSession"],
              message:
                "New code should use requireSession()/getAuthenticatedUser() from '@/lib/auth' instead of raw getServerSession (ADR-0003). Legacy routes are migrated in phases.",
            },
            {
              name: "@/lib/auth",
              importNames: [
                "normalizeUserId",
                "isDemoUser",
                "getDemoUser",
                "getDemoUserId",
              ],
              message:
                "Deprecated demo-user helpers (temporary barrel re-exports; removal tracked by ADR-0025). New code should use getAuthenticatedUser()/requireSession() from '@/lib/auth'.",
            },
          ],
        },
      ],
    },
  },
  // ...except inside the auth module itself and the NextAuth route handler,
  // which are the two legitimate consumers of '@/lib/auth/config'.
  {
    files: ["src/lib/auth/**", "src/app/api/auth/\\[...nextauth\\]/**"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": "off",
    },
  },
  // ADR-0020 — the public share surface is anonymous by design: nothing under
  // src/app/share/** or src/app/api/share/** may import the auth module.
  // Access rules there come from withApiAuth({ access: 'public' }) and the
  // share-token/cookie primitives in '@/lib/sharing/report-share' — never from
  // a session. NOTE: this object REPLACES the global no-restricted-imports
  // config for these files (flat-config override semantics), so the ADR-0003
  // base paths are repeated here.
  {
    files: ["src/app/share/**", "src/app/api/share/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...restrictedAuthImportPaths,
            {
              name: "@/lib/auth",
              message:
                "The /share and /api/share surfaces are anonymous by design and must never import the auth module (ADR-0020). Use withApiAuth({ access: 'public' }) and '@/lib/sharing/report-share'.",
            },
            {
              name: "next-auth",
              message:
                "The /share and /api/share surfaces are anonymous by design and must never import next-auth (ADR-0020).",
            },
          ],
          patterns: [
            {
              group: ["@/lib/auth/*", "next-auth/*"],
              message:
                "The /share and /api/share surfaces are anonymous by design and must never import the auth module (ADR-0020).",
            },
          ],
        },
      ],
    },
  },
  // ADR-0003 Phase 3.3 — make the unawaited-Promise defect class a lint error
  // in API routes and dashboard server components (type-aware rules; require
  // the TS project service).
  {
    files: ["src/app/api/**/*.ts", "src/app/dashboard/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
];

export default eslintConfig;
