import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../features/auth/LoginScreen';
import { SignUpScreen } from '../features/auth/SignUpScreen';
import { UnlockScreen } from '../features/auth/UnlockScreen';
import { useAppSelector } from '../app/hooks';
import { useReduceMotion } from '../app/useReduceMotion';
import { pushAnimation } from './stackAnimations';

export type AuthStackParamList = {
  Unlock: undefined;
  Login: undefined;
  SignUp: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  // Evaluated once, when this navigator mounts (i.e. right after signing
  // out, or on a cold start with no session) - by then RootNavigator has
  // already loaded biometryEnabled, so this isn't a stale read.
  const biometryEnabled = useAppSelector((state) => state.auth.biometryEnabled);
  const reduceMotion = useReduceMotion();

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, ...pushAnimation(reduceMotion) }}
      initialRouteName={biometryEnabled ? 'Unlock' : 'Login'}
    >
      <Stack.Screen name="Unlock" component={UnlockScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
