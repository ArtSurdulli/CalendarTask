import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DayView } from './DayView';
import { MonthGrid } from './MonthGrid';
import { getNextMonth, getPreviousMonth, toLocalISOString } from './dateUtils';
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

  const goToAddEvent = () => {
    navigation.navigate('EventForm', { date: toLocalISOString(selectedDay) });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {format(displayedMonth, 'MMMM yyyy')}
        </Text>

        <View style={styles.headerRightGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={goToPreviousMonth}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>{'‹'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={goToNextMonth}
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
        onSelectEvent={(id) => navigation.navigate('EventForm', { eventId: id })}
        onCreate={goToAddEvent}
      />
    </SafeAreaView>
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
  gridCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
