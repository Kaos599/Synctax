// Stub for react-devtools-core — Ink's reconciler conditionally imports this
// package when process.env.DEV is set. At runtime without DEV set, the import
// branch is never reached. This stub makes the bundle resolvable on Node.js
// where the real package is not installed.
const devtools = {
  initialize: () => {},
  connectToDevTools: () => {},
};

export default devtools;
