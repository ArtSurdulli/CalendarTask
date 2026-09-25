module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Measure all of src/, not just files some test happens to import, so
  // untested files count as 0% rather than being left out entirely.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
  ],
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
