import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { loadBiometricStatus, restoreSession } from '../features/auth/authSlice';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { colors } from '../theme';

export function RootNavigator() {
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
