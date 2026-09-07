module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-reanimated 4.x는 worklet 변환을 react-native-worklets 패키지에 위임한다 —
    // 반드시 plugins 배열의 마지막에 와야 한다.
    plugins: ["react-native-worklets/plugin"],
  };
};
