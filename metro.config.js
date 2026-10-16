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

config.resolver.resolveRequest = (context, moduleName, platform) => {
  return context.resolveRequest(
    context,
    moduleName === "three" ? threeModulePath : moduleName,
    platform,
  );
};

// Let `require("./model.glb")` bundle 3D models as assets (Metro doesn't know these types).
// .bin holds the geometry for multi-file .gltf models.
config.resolver.assetExts.push("glb", "gltf", "bin");

module.exports = config;
