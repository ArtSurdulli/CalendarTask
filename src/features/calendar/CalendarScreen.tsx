import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isSameMonth } from 'date-fns';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DayScheduleView } from './DayScheduleView';
import { DayView } from './DayView';
import { MonthGrid } from './MonthGrid';
import { type ViewMode, useViewModeCrossFade } from './useViewModeCrossFade';
import {
  getNextDay,
  getNextMonth,
  getPreviousDay,
  getPreviousMonth,
  toLocalISOString,
} from './dateUtils';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  loadEvents,
  selectEventCategoriesByDayForMonth,
  selectEventCountsByDayForMonth,
  selectEventsForDay,
} from '../events/eventsSlice';
import { colors, radius, shadows, spacing } from '../../theme';
import type { CalendarStackParamList } from '../../navigation/CalendarNavigator';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarHome'>;

export function CalendarScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);

  const [today] = useState(() => new Date());
  const { viewMode, outgoingMode, opacities, changeViewMode } = useViewModeCrossFade('month');
  const [displayedMonth, setDisplayedMonth] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);

  const dayEvents = useAppSelector((state) => selectEventsForDay(state, selectedDay));
  const eventCountsByDay = useAppSelector((state) =>
    selectEventCountsByDayForMonth(state, displayedMonth),
  );
  const eventCategoriesByDay = useAppSelector((state) =>
    selectEventCategoriesByDayForMonth(state, displayedMonth),
  );

  useEffect(() => {
    if (userId) {
      dispatch(loadEvents(userId));
    }
  }, [dispatch, userId]);

  const goToPreviousMonth = () =>
    setDisplayedMonth((current) => getPreviousMonth(current));
  const goToNextMonth = () =>
    setDisplayedMonth((current) => getNextMonth(current));

  // Day navigation also keeps the month grid in sync with wherever it
  // lands, so switching back to Month view shows the right month instead
  // of wherever it was left - but only for these buttons. Tapping an
  // out-of-month cell directly in the grid deliberately doesn't do this
  // (Month mode is unchanged).
  const goToPreviousDay = () => {
    const next = getPreviousDay(selectedDay);
    setSelectedDay(next);
    setDisplayedMonth((month) => (isSameMonth(next, month) ? month : next));
  };
  const goToNextDay = () => {
    const next = getNextDay(selectedDay);
    setSelectedDay(next);
    setDisplayedMonth((month) => (isSameMonth(next, month) ? month : next));
  };

  const goToAddEvent = () => {
    navigation.navigate('EventForm', { date: toLocalISOString(selectedDay) });
  };

  const goToAddEventAtHour = (hour: number) => {
    navigation.navigate('EventForm', { date: toLocalISOString(selectedDay), hour });
  };

  const goToEditEvent = (id: string) => navigation.navigate('EventForm', { eventId: id });

  const renderViewMode = (mode: ViewMode) =>
    mode === 'month' ? (
      <>
        <View style={[styles.gridCard, shadows.card]}>
          <MonthGrid
            month={displayedMonth}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            eventCountsByDay={eventCountsByDay}
            eventCategoriesByDay={eventCategoriesByDay}
          />
        </View>

        <DayView
          day={selectedDay}
          events={dayEvents}
          onSelectEvent={goToEditEvent}
          onCreate={goToAddEvent}
        />
      </>
    ) : (
      <DayScheduleView
        day={selectedDay}
        events={dayEvents}
        onSelectEvent={goToEditEvent}
        onCreate={goToAddEventAtHour}
      />
    );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {viewMode === 'month'
            ? format(displayedMonth, 'MMMM yyyy')
            : format(selectedDay, 'EEEE, MMMM d, yyyy')}
        </Text>

        <View style={styles.headerRightGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'month' ? 'Previous month' : 'Previous day'}
            onPress={viewMode === 'month' ? goToPreviousMonth : goToPreviousDay}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>{'‹'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'month' ? 'Next month' : 'Next day'}
            onPress={viewMode === 'month' ? goToNextMonth : goToNextDay}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>{'›'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add event"
            onPress={goToAddEvent}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>{'+'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.segmentedControlRow}>
        <ViewModeSwitch value={viewMode} onChange={changeViewMode} />
      </View>

      {/*
        Layers are always rendered in the same order (never keyed or
        reordered), so a layer that becomes the outgoing one keeps its
        position and is never remounted mid-transition.
      */}
      <View style={styles.viewModeStage}>
        {VIEW_MODES.map(({ mode }) => {
          const isCurrent = mode === viewMode;
          if (!isCurrent && mode !== outgoingMode) {
            return null;
          }
          return (
            <Animated.View
              key={mode}
              style={[styles.viewModeLayer, { opacity: opacities[mode] }]}
              // The fading-out layer is visual only: no touches, and hidden
              // from screen readers.
              pointerEvents={isCurrent ? 'auto' : 'none'}
              accessibilityElementsHidden={!isCurrent}
              importantForAccessibility={isCurrent ? 'auto' : 'no-hide-descendants'}
            >
              {renderViewMode(mode)}
            </Animated.View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

interface ViewModeSwitchProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'month', label: 'Month' },
  { mode: 'day', label: 'Day' },
];

function ViewModeSwitch({ value, onChange }: ViewModeSwitchProps) {
  return (
    <View style={styles.segmentedControl}>
      {VIEW_MODES.map(({ mode, label }) => {
        const selected = value === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} view`}
            onPress={() => onChange(mode)}
            style={[styles.segment, selected && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    marginRight: spacing.sm,
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  navButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  viewModeStage: {
    flex: 1,
  },
  viewModeLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  segmentedControlRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 2,
  },
  segment: {
    minWidth: 72,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.onPrimary,
  },
  gridCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
