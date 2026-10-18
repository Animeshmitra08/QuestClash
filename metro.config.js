// Learn more https://docs.expo.dev/guides/customizing-metro/
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Force a single copy of Three.js, and keep it off three.cjs.
// @react-three/fiber/native ships as CommonJS, so its `require("three")` would resolve to
// three/build/three.cjs, while our `import ... from "three"` resolves to three.module.js.
// Two copies double the bundle size and break `instanceof` checks between them. Worse,
// three.cjs calls Node's `process.emitWarning`, which crashes on React Native
// ("TypeError: undefined is not a function").
const threeModulePath = path.join(
  path.dirname(require.resolve("three")),
  "three.module.js",
);

// The Colyseus SDK imports the Node-only `ws` package but uses React Native's built-in
// WebSocket whenever one exists (`globalThis.WebSocket || ws`). Point `ws` at an empty
// module so Metro doesn't try to bundle Node's networking modules.
const wsShimPath = path.join(__dirname, "src", "net", "wsShim.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "ws") return { type: "sourceFile", filePath: wsShimPath };
  return context.resolveRequest(
    context,
    moduleName === "three" ? threeModulePath : moduleName,
    platform,
  );
};

// server/ is a separate Node project (with its own node_modules); keep Metro out of it.
config.resolver.blockList = [new RegExp(`${path.join(__dirname, "server").replace(/[\\/]/g, "[\\\\/]")}[\\\\/].*`)];

// Let `require("./model.glb")` bundle 3D models as assets (Metro doesn't know these types).
// .bin holds the geometry for multi-file .gltf models.
config.resolver.assetExts.push("glb", "gltf", "bin");

module.exports = config;
