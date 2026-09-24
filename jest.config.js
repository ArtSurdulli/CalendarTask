module.exports = {
  preset: 'react-native',
  // The RN preset's default only allows-list RN's own packages; navigation,
  // redux and their peers ship ESM builds in node_modules that also need
  // to go through babel-jest, or `import` statements blow up under Jest.
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|@react-native-async-storage' +
      '|@react-navigation' +
      '|react-redux' +
      '|@reduxjs/toolkit' +
      '|immer' +
      '|react-native-screens' +
      '|react-native-safe-area-context' +
      ')/)',
  ],
};
