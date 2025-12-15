module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated plugin disabled for Expo Go compatibility
      // Note: BottomSheet component will not work without this
      // To use reanimated features, create a development build instead of using Expo Go
      // 'react-native-reanimated/plugin',
    ],
  };
};





