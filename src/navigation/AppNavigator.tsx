import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { CalendarNavigator } from './CalendarNavigator';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { colors, radius, spacing } from '../theme';

export type AppTabParamList = {
  Calendar: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

/**
 * react-native-svg isn't a dependency of this project, so tab icons are
 * dropped entirely rather than pulling in a new native dependency for
 * them - the active tab is unambiguous from the accent-tinted pill and
 * accent-coloured, heavier label alone.
 *
 * This is a full `tabBarButton` override (not `tabBarLabel`/`tabBarIcon`)
 * so none of the library's default composition - including its default
 * blue tint or icon slot - ever renders; everything here is our own.
 */
function TabButton({
  label,
  onPress,
  accessibilityState,
  accessibilityLabel,
  testID,
  style,
  'aria-selected': ariaSelected,
}: BottomTabBarButtonProps & { label: string }) {
  // react-navigation's BottomTabItem actually signals selection via the
  // `aria-selected` prop, not `accessibilityState.selected` (which it
  // never sets when a custom tabBarButton is used) - reading only the
  // latter left every tab permanently reading as unselected.
  const focused = accessibilityState?.selected ?? ariaSelected ?? false;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={[styles.tabButton, style]}
      testID={testID}
    >
      <View style={[styles.pill, focused && styles.pillActive]}>
        <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// Hoisted to module scope (rather than defined inline in AppNavigator)
// so `tabBarButton` gets a stable function reference across renders,
// instead of a new one react-navigation would treat as a different
// component every time.
function renderCalendarTabButton(props: BottomTabBarButtonProps) {
  return <TabButton {...props} label="Calendar" />;
}

function renderProfileTabButton(props: BottomTabBarButtonProps) {
  return <TabButton {...props} label="Profile" />;
}

export function AppNavigator() {
  return (
    // Screens manage their own SafeAreaView/header content, so the tab
    // navigator's default header is turned off to avoid a duplicate bar.
    // CalendarNavigator manages its own header for the modal EventForm.
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="Calendar"
        component={CalendarNavigator}
        options={{ tabBarButton: renderCalendarTabButton }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarButton: renderProfileTabButton }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  pillActive: {
    backgroundColor: colors.accentTint,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelInactive: {
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: '700',
  },
});
