// API project only: integration-style route tests get a 20s per-test budget.
// (jest's `testTimeout` option is global-scope only — it is invalid inside a
// `projects` entry — so the API project sets it here instead.)
jest.setTimeout(20000)
