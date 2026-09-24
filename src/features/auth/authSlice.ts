import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authRepository, type SignInInput, type SignUpInput } from './authRepository';
import { biometricRepository, type BiometryType } from './biometricRepository';
import type { User } from '../../types';

export type AuthStatus = 'booting' | 'idle' | 'loading';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  /** The biometry type this device supports, or null if none. */
  biometrySupported: BiometryType | null;
  /** Whether the current device has a stored biometric credential. */
  biometryEnabled: boolean;
}

const initialState: AuthState = {
  user: null,
  status: 'booting',
  error: null,
  biometrySupported: null,
  biometryEnabled: false,
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export const restoreSession = createAsyncThunk<User | null, void, { rejectValue: string }>(
  'auth/restoreSession',
  async (_arg, { rejectWithValue }) => {
    try {
      const session = await authRepository.restoreSession();
      return session ? session.user : null;
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

export const signIn = createAsyncThunk<User, SignInInput, { rejectValue: string }>(
  'auth/signIn',
  async (input, { rejectWithValue }) => {
    try {
      const session = await authRepository.signIn(input);
      return session.user;
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

export const signUp = createAsyncThunk<User, SignUpInput, { rejectValue: string }>(
  'auth/signUp',
  async (input, { rejectWithValue }) => {
    try {
      const session = await authRepository.signUp(input);
      return session.user;
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

export const signOut = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/signOut',
  async (_arg, { rejectWithValue }) => {
    try {
      await authRepository.signOut();
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

export interface BiometricStatus {
  supported: BiometryType | null;
  enabled: boolean;
}

/** Checked at boot, and again after enabling/disabling from the Profile screen. */
export const loadBiometricStatus = createAsyncThunk<
  BiometricStatus,
  void,
  { rejectValue: string }
>('auth/loadBiometricStatus', async (_arg, { rejectWithValue }) => {
  try {
    const supported = await biometricRepository.isSupported();
    const enabled = await biometricRepository.isEnabled();
    return { supported, enabled };
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const enableBiometrics = createAsyncThunk<
  void,
  SignInInput,
  { rejectValue: string }
>('auth/enableBiometrics', async ({ email, password }, { rejectWithValue }) => {
  try {
    // Verify the password is actually correct before storing it behind
    // Face ID - a typo here would otherwise silently make biometric
    // sign-in fail every time later, with no clue why.
    await authRepository.signIn({ email, password });
    await biometricRepository.enable(email, password);
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

export const disableBiometrics = createAsyncThunk<void, void, { rejectValue: string }>(
  'auth/disableBiometrics',
  async (_arg, { rejectWithValue }) => {
    try {
      await biometricRepository.disable();
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  },
);

/**
 * Signs in using the stored biometric credential. Triggers the OS
 * prompt. Resolves to `null` - not a rejection - if the user cancels or
 * the entry is gone, since those are normal outcomes: the caller just
 * stays on the unlock screen.
 */
export const signInWithBiometrics = createAsyncThunk<
  User | null,
  void,
  { rejectValue: string }
>('auth/signInWithBiometrics', async (_arg, { rejectWithValue }) => {
  try {
    const stored = await biometricRepository.getCredentials();
    if (!stored) {
      return null;
    }
    const session = await authRepository.signIn(stored);
    return session.user;
  } catch (error) {
    return rejectWithValue(errorMessage(error));
  }
});

/**
 * Whether to offer "Use Face ID to sign in next time?" right after a
 * successful password sign-in: only when biometrics are supported, not
 * already enabled, and this email hasn't already declined the offer.
 * A plain read - no state to update, so no need for a full thunk.
 */
export async function checkBiometricEnrollmentOffer(
  email: string,
): Promise<{ shouldOffer: boolean; biometryType: BiometryType | null }> {
  const biometryType = await biometricRepository.isSupported();
  if (!biometryType) {
    return { shouldOffer: false, biometryType: null };
  }
  if (await biometricRepository.isEnabled()) {
    return { shouldOffer: false, biometryType };
  }
  const declined = await authRepository.hasDeclinedBiometricPrompt(email);
  return { shouldOffer: !declined, biometryType };
}

/** Remembers a "Not Now" so the offer isn't repeated every sign-in. */
export async function declineBiometricPrompt(email: string): Promise<void> {
  await authRepository.setDeclinedBiometricPrompt(email);
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.status = 'booting';
        state.error = null;
      })
      .addCase(restoreSession.fulfilled, (state, action: PayloadAction<User | null>) => {
        state.user = action.payload;
        state.status = 'idle';
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.user = null;
        state.status = 'idle';
        state.error = action.payload ?? 'Failed to restore session.';
      })

      .addCase(signIn.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.status = 'idle';
      })
      .addCase(signIn.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Sign in failed.';
      })

      .addCase(signUp.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
        state.status = 'idle';
      })
      .addCase(signUp.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Sign up failed.';
      })

      .addCase(signOut.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.status = 'idle';
        // biometrySupported/biometryEnabled are untouched - signing out
        // keeps the stored Keychain credential.
      })
      .addCase(signOut.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Sign out failed.';
      })

      .addCase(loadBiometricStatus.fulfilled, (state, action: PayloadAction<BiometricStatus>) => {
        state.biometrySupported = action.payload.supported;
        state.biometryEnabled = action.payload.enabled;
      })
      .addCase(loadBiometricStatus.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to check Face ID availability.';
      })

      .addCase(enableBiometrics.fulfilled, (state) => {
        state.biometryEnabled = true;
      })
      .addCase(enableBiometrics.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to enable Face ID.';
      })

      .addCase(disableBiometrics.fulfilled, (state) => {
        state.biometryEnabled = false;
      })
      .addCase(disableBiometrics.rejected, (state, action) => {
        state.error = action.payload ?? 'Failed to disable Face ID.';
      })

      .addCase(signInWithBiometrics.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signInWithBiometrics.fulfilled, (state, action: PayloadAction<User | null>) => {
        state.status = 'idle';
        // A null payload means the user cancelled the prompt, or the
        // entry was gone - a normal outcome, not an error, so `user` and
        // `error` are both left alone.
        if (action.payload) {
          state.user = action.payload;
        }
      })
      .addCase(signInWithBiometrics.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Face ID sign-in failed.';
      });
  },
});

export default authSlice.reducer;
