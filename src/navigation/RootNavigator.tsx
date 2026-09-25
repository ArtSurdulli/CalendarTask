import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadBiometricStatus, restoreSession } from '../features/auth/authSlice';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { makeStyles, useTheme, type Theme } from '../theme';

/**
 * React Navigation's own theme drives the surfaces it draws itself - the
 * event form's native header and each screen's default background - so it
 * is built from the same palette as everything else.
 */
function toNavigationTheme({ scheme, colors }: Theme): NavigationTheme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  };
}

export function RootNavigator() {
  const styles = useStyles();
  const theme = useTheme();
  const navigationTheme = useMemo(() => toNavigationTheme(theme), [theme]);
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  const user = useAppSelector((state) => state.auth.user);

  // AuthNavigator reads biometryEnabled synchronously on its first render
  // to pick Unlock vs Login, so the boot spinner must wait for this too,
  // not just for restoreSession - otherwise it would always start on
  // Login even when a biometric credential exists.
  const [biometricStatusLoaded, setBiometricStatusLoaded] = useState(false);

  useEffect(() => {
    dispatch(restoreSession());
    dispatch(loadBiometricStatus()).finally(() => setBiometricStatusLoaded(true));
  }, [dispatch]);

  if (status === 'booting' || !biometricStatusLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  }),
);
