import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { signInWithBiometrics } from './authSlice';
import { describeBiometryType } from './biometricRepository';
import { colors, radius, spacing } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Unlock'>;

/**
 * Shown at launch instead of the password form when a biometric
 * credential exists. Never triggers the OS prompt automatically - an
 * unprompted system dialog on cold start is disorienting - so unlocking
 * is a deliberate tap, and the password form is always one tap away too.
 */
export function UnlockScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const biometrySupported = useAppSelector((state) => state.auth.biometrySupported);
  const status = useAppSelector((state) => state.auth.status);
  const error = useAppSelector((state) => state.auth.error);
  const isUnlocking = status === 'loading';
  const biometryLabel = describeBiometryType(biometrySupported);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Unlock with {biometryLabel} to continue.</Text>

        {error ? (
          <Text
            style={styles.error}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use ${biometryLabel}`}
          accessibilityState={{ disabled: isUnlocking }}
          disabled={isUnlocking}
          onPress={() => dispatch(signInWithBiometrics())}
          style={[styles.primaryButton, isUnlocking && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {isUnlocking ? 'Unlocking…' : `Use ${biometryLabel}`}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use password instead"
          onPress={() => navigation.navigate('Login')}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Use password instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.md,
  },
  linkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
