/**
 * Wraps react-native-keychain for Face ID / Touch ID unlock.
 *
 * The mock auth backend (authRepository.ts) stores passwords in PLAIN
 * TEXT in AsyncStorage - it's a stand-in for a real backend, not a
 * secure credential store. The Keychain entry this file manages is the
 * ONLY credential store in this app with real OS-level protection
 * (Secure Enclave-backed, gated by biometry). With a real backend you
 * would NOT store the user's password here at all - you'd store a
 * refresh token issued at sign-in, and biometric unlock would exchange
 * it for a fresh session. We store a password only because this app's
 * mock backend has no token concept to exchange it for.
 *
 * This is the ONLY file allowed to import react-native-keychain
 * directly. Screens and the Redux slice go through `BiometricRepository`
 * instead.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.calendartask.biometric-credentials';
/**
 * Which account the stored credential belongs to, kept outside the Keychain
 * item so it can be read without a biometric prompt. Not secret - it's the
 * same email the credential's own username holds.
 */
const OWNER_EMAIL_KEY = '@biometric/owner-email';

export type BiometryType = Keychain.BIOMETRY_TYPE;

export interface StoredCredentials {
  email: string;
  password: string;
}

export interface BiometricRepository {
  /** The biometry type available on this device, or null if unsupported. */
  isSupported(): Promise<BiometryType | null>;
  /** Whether a credential is currently stored (no prompt triggered). */
  isEnabled(): Promise<boolean>;
  /**
   * Email of the account the stored credential belongs to (lowercased), or
   * null if none is recorded. No prompt triggered.
   */
  getOwnerEmail(): Promise<string | null>;
  /**
   * Stores `email`/`password` behind biometric access control. Gated by
   * BIOMETRY_CURRENT_SET, which matters: the entry invalidates itself if
   * the user enrols a new face or fingerprint, rather than silently
   * accepting whatever biometry is on the device *now*. Replaces any
   * credential already stored, including another account's.
   */
  enable(email: string, password: string): Promise<void>;
  /**
   * Triggers the OS biometric prompt and returns the stored credentials,
   * or null if the user cancels or the entry is gone - both normal
   * outcomes, not errors.
   */
  getCredentials(): Promise<StoredCredentials | null>;
  disable(): Promise<void>;
}

/** Human-readable label for a biometry type, for prompts and buttons. */
export function describeBiometryType(type: BiometryType | null): string {
  switch (type) {
    case Keychain.BIOMETRY_TYPE.FACE_ID:
      return 'Face ID';
    case Keychain.BIOMETRY_TYPE.TOUCH_ID:
      return 'Touch ID';
    case Keychain.BIOMETRY_TYPE.OPTIC_ID:
      return 'Optic ID';
    case Keychain.BIOMETRY_TYPE.FINGERPRINT:
      return 'fingerprint unlock';
    case Keychain.BIOMETRY_TYPE.FACE:
      return 'face unlock';
    case Keychain.BIOMETRY_TYPE.IRIS:
      return 'iris unlock';
    default:
      return 'biometric unlock';
  }
}

/** The iOS "User canceled the operation." message from a dismissed prompt. */
function isCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

/** Defensive: the OS purges an invalidated (re-enrolled) entry, but just
 * in case a lookup ever throws instead of resolving false for it. */
function isMissingEntry(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not.*found/i.test(message);
}

class KeychainBiometricRepository implements BiometricRepository {
  async isSupported(): Promise<BiometryType | null> {
    return Keychain.getSupportedBiometryType();
  }

  async isEnabled(): Promise<boolean> {
    return Keychain.hasGenericPassword({ service: SERVICE });
  }

  async getOwnerEmail(): Promise<string | null> {
    return AsyncStorage.getItem(OWNER_EMAIL_KEY);
  }

  async enable(email: string, password: string): Promise<void> {
    const result = await Keychain.setGenericPassword(email, password, {
      service: SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    if (!result) {
      throw new Error('Failed to enable Face ID sign-in.');
    }
    await AsyncStorage.setItem(OWNER_EMAIL_KEY, email.trim().toLowerCase());
  }

  async getCredentials(): Promise<StoredCredentials | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: SERVICE });
      if (!result) {
        return null;
      }
      return { email: result.username, password: result.password };
    } catch (error) {
      if (isCancellation(error) || isMissingEntry(error)) {
        return null;
      }
      throw error;
    }
  }

  async disable(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE });
    await AsyncStorage.removeItem(OWNER_EMAIL_KEY);
  }
}

export const biometricRepository: BiometricRepository = new KeychainBiometricRepository();
