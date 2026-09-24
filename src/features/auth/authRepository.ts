/**
 * Local AsyncStorage-backed implementation of AuthRepository.
 *
 * SECURITY NOTE: this is a mock backend for a take-home exercise, not a
 * production auth system - passwords are stored in PLAIN TEXT in
 * AsyncStorage. Do not carry that over to anywhere real. A production
 * swap would replace this file with one that talks to a real backend
 * over HTTPS, where passwords are hashed server-side and this repository
 * never sees them again after signUp/signIn.
 *
 * This is the documented swap point for a real backend, and the ONLY
 * file in the app allowed to import AsyncStorage directly. Screens and
 * Redux slices go through the `AuthRepository` interface instead.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../../types';

const USERS_KEY = '@auth/users';
const SESSION_KEY = '@auth/session';
const BIOMETRIC_PROMPT_DECLINED_KEY = '@auth/biometric-prompt-declined';

export interface Session {
  token: string;
  user: User;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthRepository {
  signUp(input: SignUpInput): Promise<Session>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  restoreSession(): Promise<Session | null>;
  /** Whether `email` has already dismissed the "enable biometric unlock?" offer. */
  hasDeclinedBiometricPrompt(email: string): Promise<boolean>;
  setDeclinedBiometricPrompt(email: string): Promise<void>;
}

/** A stored user record, including the (plain-text, mock-only) password. */
interface StoredUser extends User {
  password: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateToken(): string {
  return `token_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toPublicUser(stored: StoredUser): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...user } = stored;
  return user;
}

async function readUsers(): Promise<StoredUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? (JSON.parse(raw) as StoredUser[]) : [];
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function writeSession(session: Session): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

class LocalAuthRepository implements AuthRepository {
  async signUp({ name, email, password }: SignUpInput): Promise<Session> {
    const normalizedEmail = normalizeEmail(email);
    const users = await readUsers();

    if (users.some((user) => user.email === normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const newUser: StoredUser = {
      id: generateId(),
      name,
      email: normalizedEmail,
      password,
    };

    await writeUsers([...users, newUser]);

    const session: Session = { token: generateToken(), user: toPublicUser(newUser) };
    await writeSession(session);
    return session;
  }

  async signIn({ email, password }: SignInInput): Promise<Session> {
    const normalizedEmail = normalizeEmail(email);
    const users = await readUsers();
    const match = users.find(
      (user) => user.email === normalizedEmail && user.password === password,
    );

    if (!match) {
      throw new Error('Incorrect email or password.');
    }

    const session: Session = { token: generateToken(), user: toPublicUser(match) };
    await writeSession(session);
    return session;
  }

  async signOut(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
  }

  async restoreSession(): Promise<Session | null> {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  }

  async hasDeclinedBiometricPrompt(email: string): Promise<boolean> {
    const declined = await readDeclinedBiometricEmails();
    return declined.includes(normalizeEmail(email));
  }

  async setDeclinedBiometricPrompt(email: string): Promise<void> {
    const declined = await readDeclinedBiometricEmails();
    const normalizedEmail = normalizeEmail(email);

    if (!declined.includes(normalizedEmail)) {
      await AsyncStorage.setItem(
        BIOMETRIC_PROMPT_DECLINED_KEY,
        JSON.stringify([...declined, normalizedEmail]),
      );
    }
  }
}

async function readDeclinedBiometricEmails(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(BIOMETRIC_PROMPT_DECLINED_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export const authRepository: AuthRepository = new LocalAuthRepository();
