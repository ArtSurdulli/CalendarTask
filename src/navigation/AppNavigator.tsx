import React from 'react';
import { Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type {
  BottomTabBarButtonProps,
  BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { CalendarNavigator } from './CalendarNavigator';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { makeStyles, motion, radius, spacing } from '../theme';
import { useReduceMotion } from '../app/useReduceMotion';

export type AppTabParamList = {
  Calendar: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

/**
 * Bar height above the bottom safe-area inset: room for the 36pt active
 * pill with even space above and below, rather than a pill that fills the
 * bar edge to edge.
 */
const TAB_BAR_HEIGHT = 56;

/** Fixed pill size, so the active and inactive tabs occupy identical boxes. */
const PILL_HEIGHT = 36;
const PILL_MIN_WIDTH = 104;

/**
 * react-native-svg isn't a dependency of this project, so tab icons are
 * dropped entirely rather than pulling in a new native dependency for
 * them - the active tab is unambiguous from its solid accent pill and
 * heavier label alone. Both tabs render the same-sized pill (transparent
 * when inactive), so switching tabs never shifts the layout.
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
  const styles = useStyles();
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

/**
 * Cross-fade between tabs. The library's `fade` preset runs for 150ms, so
 * its spec is overridden to use the same 200ms as the app's other fades.
 */
function tabAnimation(
  reduceMotion: boolean,
): Pick<BottomTabNavigationOptions, 'animation' | 'transitionSpec'> {
  if (reduceMotion) {
    return { animation: 'none' };
  }
  return {
    animation: 'fade',
    // Same linear easing as the library's FadeSpec.
    transitionSpec: {
      animation: 'timing',
      config: { duration: motion.duration.fast, easing: Easing.linear },
    },
  };
}

export function AppNavigator() {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  // A `height` in tabBarStyle replaces the library's whole computed height
  // (49 + inset), so the inset has to be added back or the bar would sit
  // under the home indicator. The library still pads the bottom by it.
  const { bottom: bottomInset } = useSafeAreaInsets();

  return (
    // Screens manage their own SafeAreaView/header content, so the tab
    // navigator's default header is turned off to avoid a duplicate bar.
    // CalendarNavigator manages its own header for the modal EventForm.
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: TAB_BAR_HEIGHT + bottomInset }],
        ...tabAnimation(reduceMotion),
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

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: colors.card,
      // Flush against the content: no top hairline, and no Android elevation
      // shadow (the library's default draws one along the top edge).
      borderTopWidth: 0,
      elevation: 0,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pill: {
      height: PILL_HEIGHT,
      minWidth: PILL_MIN_WIDTH,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillActive: {
      backgroundColor: colors.accent,
    },
    label: {
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    labelInactive: {
      color: colors.textSecondary,
      fontWeight: '500',
    },
    labelActive: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
  }),
);
