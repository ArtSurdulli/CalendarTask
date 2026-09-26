import { configureStore } from '@reduxjs/toolkit';
import { BIOMETRY_TYPE } from 'react-native-keychain';
import authReducer, {
  checkBiometricEnrollmentOffer,
  declineBiometricPrompt,
  disableBiometrics,
  enableBiometrics,
  loadBiometricStatus,
  selectBiometryEnabledForUser,
  signIn,
  signInWithBiometrics,
} from './authSlice';
import { authRepository } from './authRepository';
import { biometricRepository } from './biometricRepository';
import type { User } from '../../types';

jest.mock('./authRepository', () => ({
  authRepository: {
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    restoreSession: jest.fn(),
    hasDeclinedBiometricPrompt: jest.fn(),
    setDeclinedBiometricPrompt: jest.fn(),
  },
}));

jest.mock('./biometricRepository', () => ({
  biometricRepository: {
    isSupported: jest.fn(),
    isEnabled: jest.fn(),
    getOwnerEmail: jest.fn(),
    enable: jest.fn(),
    getCredentials: jest.fn(),
    disable: jest.fn(),
  },
}));

const mockedAuthRepository = authRepository as jest.Mocked<typeof authRepository>;
const mockedBiometricRepository = biometricRepository as jest.Mocked<typeof biometricRepository>;

const user: User = { id: 'user-1', name: 'Ada', email: 'ada@example.com' };

function createTestStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signInWithBiometrics', () => {
  test('fulfilled with stored credentials signs the user in', async () => {
    mockedBiometricRepository.getCredentials.mockResolvedValue({
      email: user.email,
      password: 'hunter2',
    });
    mockedAuthRepository.signIn.mockResolvedValue({ token: 't1', user });

    const store = createTestStore();
    await store.dispatch(signInWithBiometrics());

    const state = store.getState().auth;
    expect(state.user).toEqual(user);
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  test('a cancelled prompt (null credentials) is a normal outcome, not an error', async () => {
    mockedBiometricRepository.getCredentials.mockResolvedValue(null);

    const store = createTestStore();
    await store.dispatch(signInWithBiometrics());

    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
    expect(mockedAuthRepository.signIn).not.toHaveBeenCalled();
  });

  test('a genuine failure sets an error', async () => {
    mockedBiometricRepository.getCredentials.mockResolvedValue({
      email: user.email,
      password: 'stale-password',
    });
    mockedAuthRepository.signIn.mockRejectedValue(new Error('Incorrect email or password.'));

    const store = createTestStore();
    await store.dispatch(signInWithBiometrics());

    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.error).toBe('Incorrect email or password.');
  });
});

describe('enableBiometrics', () => {
  test('verifies the password before storing it, then enables', async () => {
    mockedAuthRepository.signIn.mockResolvedValue({ token: 't1', user });
    mockedBiometricRepository.enable.mockResolvedValue(undefined);

    const store = createTestStore();
    await store.dispatch(enableBiometrics({ email: user.email, password: 'hunter2' }));

    expect(mockedAuthRepository.signIn).toHaveBeenCalledWith({
      email: user.email,
      password: 'hunter2',
    });
    expect(mockedBiometricRepository.enable).toHaveBeenCalledWith(user.email, 'hunter2');
    expect(store.getState().auth.biometryEnabled).toBe(true);
  });

  test('a wrong password never reaches the Keychain', async () => {
    mockedAuthRepository.signIn.mockRejectedValue(new Error('Incorrect email or password.'));

    const store = createTestStore();
    await store.dispatch(enableBiometrics({ email: user.email, password: 'wrong' }));

    expect(mockedBiometricRepository.enable).not.toHaveBeenCalled();
    const state = store.getState().auth;
    expect(state.biometryEnabled).toBe(false);
    expect(state.error).toBe('Incorrect email or password.');
  });
});

describe('disableBiometrics', () => {
  test('clears the enabled flag', async () => {
    mockedBiometricRepository.disable.mockResolvedValue(undefined);

    const store = createTestStore();
    // Start from enabled to prove the thunk actually flips it, not just
    // reads a default.
    await store.dispatch(loadBiometricStatus.fulfilled(
        { supported: null, enabled: true, ownerEmail: user.email },
        '',
        undefined,
      ));
    await store.dispatch(disableBiometrics());

    expect(store.getState().auth.biometryEnabled).toBe(false);
    expect(mockedBiometricRepository.disable).toHaveBeenCalled();
  });
});

describe('loadBiometricStatus', () => {
  test('populates supported and enabled from the repository', async () => {
    mockedBiometricRepository.isSupported.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
    mockedBiometricRepository.isEnabled.mockResolvedValue(true);

    const store = createTestStore();
    await store.dispatch(loadBiometricStatus());

    const state = store.getState().auth;
    expect(state.biometrySupported).toBe(BIOMETRY_TYPE.FACE_ID);
    expect(state.biometryEnabled).toBe(true);
  });
});

describe('checkBiometricEnrollmentOffer', () => {
  test('does not offer when biometrics are unsupported', async () => {
    mockedBiometricRepository.isSupported.mockResolvedValue(null);

    const result = await checkBiometricEnrollmentOffer(user.email);

    expect(result).toEqual({ shouldOffer: false, biometryType: null });
    expect(mockedBiometricRepository.isEnabled).not.toHaveBeenCalled();
  });

  test('does not offer when already enabled', async () => {
    mockedBiometricRepository.isSupported.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
    mockedBiometricRepository.isEnabled.mockResolvedValue(true);
    mockedBiometricRepository.getOwnerEmail.mockResolvedValue(user.email);

    const result = await checkBiometricEnrollmentOffer(user.email);

    expect(result.shouldOffer).toBe(false);
    expect(mockedAuthRepository.hasDeclinedBiometricPrompt).not.toHaveBeenCalled();
  });

  test('does not offer again once declined', async () => {
    mockedBiometricRepository.isSupported.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
    mockedBiometricRepository.isEnabled.mockResolvedValue(false);
    mockedAuthRepository.hasDeclinedBiometricPrompt.mockResolvedValue(true);

    const result = await checkBiometricEnrollmentOffer(user.email);

    expect(result).toEqual({ shouldOffer: false, biometryType: BIOMETRY_TYPE.FACE_ID });
  });

  test('offers when supported, not enabled, and not declined', async () => {
    mockedBiometricRepository.isSupported.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
    mockedBiometricRepository.isEnabled.mockResolvedValue(false);
    mockedAuthRepository.hasDeclinedBiometricPrompt.mockResolvedValue(false);

    const result = await checkBiometricEnrollmentOffer(user.email);

    expect(result).toEqual({ shouldOffer: true, biometryType: BIOMETRY_TYPE.FACE_ID });
  });
});

describe('declineBiometricPrompt', () => {
  test('persists the refusal via the repository', async () => {
    mockedAuthRepository.setDeclinedBiometricPrompt.mockResolvedValue(undefined);

    await declineBiometricPrompt(user.email);

    expect(mockedAuthRepository.setDeclinedBiometricPrompt).toHaveBeenCalledWith(user.email);
  });
});

describe('a credential stored by a different account', () => {
  const otherUser: User = { id: 'user-2', name: 'Bob', email: 'bob@example.com' };

  function storeSignedInAs(signedIn: User, ownerEmail: string | null) {
    const store = createTestStore();
    store.dispatch(signIn.fulfilled(signedIn, '', { email: signedIn.email, password: 'x' }));
    store.dispatch(
      loadBiometricStatus.fulfilled(
        { supported: BIOMETRY_TYPE.FACE_ID, enabled: true, ownerEmail },
        '',
        undefined,
      ),
    );
    return store;
  }

  test('is not treated as enabled for the signed-in account', () => {
    const store = storeSignedInAs(otherUser, user.email);

    expect(selectBiometryEnabledForUser(store.getState())).toBe(false);
    // Still on the device, so the Unlock screen can offer it to its owner.
    expect(store.getState().auth.biometryEnabled).toBe(true);
  });

  test('is treated as enabled for its owner, ignoring email case', () => {
    const store = storeSignedInAs(user, user.email.toUpperCase());

    expect(selectBiometryEnabledForUser(store.getState())).toBe(true);
  });

  test('with no recorded owner is not treated as anyone\'s', () => {
    const store = storeSignedInAs(user, null);

    expect(selectBiometryEnabledForUser(store.getState())).toBe(false);
  });

  test('does not stop the enrolment offer to another account', async () => {
    mockedBiometricRepository.isSupported.mockResolvedValue(BIOMETRY_TYPE.FACE_ID);
    mockedBiometricRepository.isEnabled.mockResolvedValue(true);
    mockedBiometricRepository.getOwnerEmail.mockResolvedValue(user.email);
    mockedAuthRepository.hasDeclinedBiometricPrompt.mockResolvedValue(false);

    const result = await checkBiometricEnrollmentOffer(otherUser.email);

    expect(result).toEqual({ shouldOffer: true, biometryType: BIOMETRY_TYPE.FACE_ID });
  });

  test('is replaced when another account enables biometrics', async () => {
    mockedAuthRepository.signIn.mockResolvedValue({ token: 't', user: otherUser });
    mockedBiometricRepository.enable.mockResolvedValue(undefined);
    const store = storeSignedInAs(otherUser, user.email);

    await store.dispatch(enableBiometrics({ email: otherUser.email, password: 'pw' }));

    expect(mockedBiometricRepository.enable).toHaveBeenCalledWith(otherUser.email, 'pw');
    expect(store.getState().auth.biometricOwnerEmail).toBe(otherUser.email);
    expect(selectBiometryEnabledForUser(store.getState())).toBe(true);
  });
});
