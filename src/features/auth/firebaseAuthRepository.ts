/**
 * Firebase Authentication implementation of AuthRepository.
 *
 * Selected over the local implementation by `USE_FIREBASE` (src/config.ts);
 * nothing outside src/app/repositories.ts knows which one is live. Firebase
 * holds the password - this file never stores it.
 *
 * Firebase error codes are mapped to the same messages the local
 * repository throws, so screens show identical errors on either backend.
 */
import {
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from '@react-native-firebase/auth';
import {
  authRepository as localAuthRepository,
  type AuthRepository,
  type Session,
  type SignInInput,
  type SignUpInput,
} from './authRepository';

const EMAIL_IN_USE = 'An account with this email already exists.';
const BAD_CREDENTIALS = 'Incorrect email or password.';

/** Firebase auth error codes -> the messages the app already shows. */
const MESSAGES_BY_CODE: Record<string, string> = {
  'auth/email-already-in-use': EMAIL_IN_USE,
  'auth/invalid-credential': BAD_CREDENTIALS,
  'auth/invalid-login-credentials': BAD_CREDENTIALS,
  'auth/wrong-password': BAD_CREDENTIALS,
  'auth/user-not-found': BAD_CREDENTIALS,
  'auth/invalid-email': BAD_CREDENTIALS,
  'auth/user-disabled': BAD_CREDENTIALS,
  'auth/weak-password': 'Password must be at least 8 characters',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network unavailable. Check your connection and try again.',
};

function toAppError(error: unknown): Error {
  const code = (error as { code?: unknown } | null)?.code;
  const message = typeof code === 'string' ? MESSAGES_BY_CODE[code] : undefined;
  return new Error(message ?? 'Something went wrong. Please try again.');
}

async function toSession(user: FirebaseUser): Promise<Session> {
  return {
    token: await getIdToken(user),
    user: { id: user.uid, name: user.displayName ?? '', email: user.email ?? '' },
  };
}

/**
 * The signed-in user once Firebase has restored any persisted session.
 * `currentUser` can still be null on a cold start until that finishes;
 * the first auth-state event is the reliable signal.
 */
function restoredUser(): Promise<FirebaseUser | null> {
  return new Promise((resolve) => {
    let settled = false;
    // Declared up front: the listener may fire before `onAuthStateChanged`
    // has returned, so only unsubscribe once both have happened.
    let unsubscribe: (() => void) | undefined;
    unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(user);
      unsubscribe?.();
    });
    if (settled) {
      unsubscribe();
    }
  });
}

class FirebaseAuthRepository implements AuthRepository {
  async signUp({ name, email, password }: SignUpInput): Promise<Session> {
    try {
      const { user } = await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
      await updateProfile(user, { displayName: name });
      return await toSession(user);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async signIn({ email, password }: SignInInput): Promise<Session> {
    try {
      const { user } = await signInWithEmailAndPassword(getAuth(), email.trim(), password);
      return await toSession(user);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async signOut(): Promise<void> {
    await signOut(getAuth());
  }

  async restoreSession(): Promise<Session | null> {
    const user = await restoredUser();
    return user ? toSession(user) : null;
  }

  // Whether this device has dismissed the biometric offer is a device
  // preference, not account data, so it stays in local storage whichever
  // backend holds the account.
  hasDeclinedBiometricPrompt(email: string): Promise<boolean> {
    return localAuthRepository.hasDeclinedBiometricPrompt(email);
  }

  setDeclinedBiometricPrompt(email: string): Promise<void> {
    return localAuthRepository.setDeclinedBiometricPrompt(email);
  }
}

export const firebaseAuthRepository: AuthRepository = new FirebaseAuthRepository();
