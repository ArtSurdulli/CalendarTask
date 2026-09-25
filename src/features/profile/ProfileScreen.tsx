import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { disableBiometrics, enableBiometrics, signOut } from '../auth/authSlice';
import { describeBiometryType } from '../auth/biometricRepository';
import { selectEventStats } from '../events/eventsSlice';
import { colors, radius, shadows, spacing } from '../../theme';

/** Profile tab: identity, biometric toggle, event stats, sign-out. */
export function ProfileScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const status = useAppSelector((state) => state.auth.status);
  const biometrySupported = useAppSelector((state) => state.auth.biometrySupported);
  const biometryEnabled = useAppSelector((state) => state.auth.biometryEnabled);
  const isSigningOut = status === 'loading';
  const biometryLabel = describeBiometryType(biometrySupported);

  // Fixed for the screen's lifetime (as on the calendar) so the memoised
  // selector sees the same month argument on every render.
  const [today] = useState(() => new Date());
  const stats = useAppSelector((state) => selectEventStats(state, today));
  const earliestEvent = stats.earliestStartsAt
    ? format(parseISO(stats.earliestStartsAt), 'MMM d, yyyy')
    : 'None yet';

  const biometricRowLabel = biometrySupported ? `${biometryLabel} sign-in` : 'Biometric sign-in';
  const biometricRowDescription = biometrySupported
    ? `Use ${biometryLabel} to sign back in without your password.`
    : "This device doesn't support Face ID or Touch ID.";

  const handleToggleBiometrics = (value: boolean) => {
    if (!value) {
      dispatch(disableBiometrics());
      return;
    }

    if (!user) {
      return;
    }

    // Re-verifying the password here (inside enableBiometrics) is
    // deliberate: this is the only place besides sign-in where we'd
    // otherwise store a password blind, with no way to tell a typo from
    // a correct one until biometric sign-in mysteriously fails later.
    Alert.prompt(
      `Enable ${biometryLabel}`,
      `Enter your password to enable ${biometryLabel} sign-in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: (password?: string) => {
            if (!password || !user) {
              return;
            }
            dispatch(enableBiometrics({ email: user.email, password }));
          },
        },
      ],
      'secure-text',
    );
  };

  const handleSignOut = () => {
    if (!biometryEnabled) {
      dispatch(signOut());
      return;
    }

    // Signing out keeps the stored credential by default - only an
    // explicit "Remove" takes it out.
    Alert.alert(
      `Remove ${biometryLabel} sign-in?`,
      `You can keep using ${biometryLabel} to sign back in, or remove it now.`,
      [
        { text: `Keep ${biometryLabel}`, style: 'cancel', onPress: () => dispatch(signOut()) },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            dispatch(disableBiometrics());
            dispatch(signOut());
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <View style={[styles.card, shadows.card]}>
          <Text style={styles.name}>{user?.name ?? 'Unknown user'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={[styles.card, shadows.card]}>
          <View style={styles.settingsRow}>
            <View style={styles.settingsTextGroup}>
              <Text
                style={[styles.settingsLabel, !biometrySupported && styles.settingsTextDisabled]}
              >
                {biometricRowLabel}
              </Text>
              <Text
                style={[
                  styles.settingsDescription,
                  !biometrySupported && styles.settingsTextDisabled,
                ]}
              >
                {biometricRowDescription}
              </Text>
            </View>
            <Switch
              accessibilityLabel={biometricRowLabel}
              accessibilityRole="switch"
              accessibilityState={{ disabled: !biometrySupported }}
              disabled={!biometrySupported}
              value={biometryEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ true: colors.accent }}
            />
          </View>
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.cardTitle}>Your events</Text>
          <StatRow label="Total events" value={String(stats.total)} />
          <StatRow label={`In ${format(today, 'MMMM')}`} value={String(stats.inMonth)} />
          <StatRow label="Earliest event" value={earliestEvent} isLast />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityState={{ disabled: isSigningOut }}
          disabled={isSigningOut}
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          <Text
            style={[styles.signOutButtonText, isSigningOut && styles.signOutButtonTextDisabled]}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  isLast?: boolean;
}

/** One label/value line in the stats card, read as a single phrase. */
function StatRow({ label, value, isLast = false }: StatRowProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.statRow, !isLast && styles.statRowDivider]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  email: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  settingsTextGroup: {
    flex: 1,
    flexShrink: 1,
    marginRight: spacing.md,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  settingsDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingsTextDisabled: {
    color: colors.textMuted,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  statRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  signOutButtonTextDisabled: {
    opacity: 0.6,
  },
  signOutButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
