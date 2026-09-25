/* eslint-env jest */
// Tests run against the local repository implementations. Force the
// backend switch off and stub the Firebase implementations, so their
// react-native-firebase imports (native modules, ESM) never load in Jest.
jest.mock('./src/config', () => ({ USE_FIREBASE: false }));
jest.mock('./src/features/auth/firebaseAuthRepository', () => ({}));
jest.mock('./src/features/events/firebaseEventRepository', () => ({}));
