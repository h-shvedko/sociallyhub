// Minimal CSS module stub (identity-obj-proxy is not installed).
// Returns the requested class name so snapshot/class assertions stay readable.
module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => (prop === '__esModule' ? false : String(prop)),
  }
)
