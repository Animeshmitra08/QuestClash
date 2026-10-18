// Stand-in for the Node-only `ws` package in the app bundle (see metro.config.js).
// The Colyseus SDK only falls back to `ws` when there is no global WebSocket,
// and React Native always provides one.
module.exports = undefined;
