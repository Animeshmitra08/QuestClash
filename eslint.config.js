// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // React Three Fiber elements (<mesh args position …>) are not DOM elements.
    // This rule only knows DOM props; TypeScript already type-checks R3F props.
    files: ["src/game/**/*.tsx"],
    rules: {
      "react/no-unknown-property": "off",
    },
  },
]);
