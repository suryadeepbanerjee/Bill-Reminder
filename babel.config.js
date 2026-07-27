module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4: jsxImportSource is the only required NativeWind config here.
      // "nativewind/babel" is a v2 preset — do NOT include it for v4.
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};
