// Ambient typing for the injected global `jest` object (ADR-0021 Track D).
//
// The repo has no @types/jest, and suites MUST use the GLOBAL `jest` for
// jest.mock(...) calls: next/jest's SWC transform hoists jest.mock above the
// (ESM-hoisted) imports ONLY when `jest` is the global. Importing `jest`
// from '@jest/globals' shadows the global and silently defeats hoisting —
// route modules then load BEFORE the mocks are registered.
//
// Other globals (describe/it/expect/beforeAll/...) don't need hoisting, so
// suites import those from '@jest/globals' for their types.

import type { jest as jestGlobal } from '@jest/globals'

declare global {
  const jest: typeof jestGlobal
}

export {}
