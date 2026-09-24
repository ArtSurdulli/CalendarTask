import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FormField } from '../../components/FormField';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  checkBiometricEnrollmentOffer,
  declineBiometricPrompt,
  enableBiometrics,
  signIn,
} from './authSlice';
import { describeBiometryType } from './biometricRepository';
import { colors, radius, spacing } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  const formError = useAppSelector((state) => state.auth.error);
  const isSubmitting = status === 'loading';

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => {
    dispatch(signIn(values)).then((result) => {
      if (signIn.fulfilled.match(result)) {
        offerBiometricEnrollment(values.email, values.password);
      }
    });
  };

  // Ask at most once per email per "Not Now": on a successful sign-in,
  // if biometrics are supported, not already enabled, and this email
  // hasn't already declined, offer to store the credential behind
  // Face ID/Touch ID for next time.
  const offerBiometricEnrollment = async (email: string, password: string) => {
    const { shouldOffer, biometryType } = await checkBiometricEnrollmentOffer(email);
    if (!shouldOffer || !biometryType) {
      return;
    }

    const label = describeBiometryType(biometryType);
    Alert.alert(`Use ${label} to sign in next time?`, undefined, [
      {
        text: 'Not Now',
        style: 'cancel',
        onPress: () => {
          declineBiometricPrompt(email);
        },
      },
      {
        text: `Use ${label}`,
        onPress: () => {
          dispatch(enableBiometrics({ email, password }));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Welcome back</Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Email"
              accessibilityLabel="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField
              label="Password"
              accessibilityLabel="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry
              textContentType="password"
            />
          )}
        />

        {formError ? (
          <Text
            style={styles.formError}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {formError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log in"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to sign up"
          onPress={() => navigation.navigate('SignUp')}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Don&apos;t have an account? Sign up</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  formError: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
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
