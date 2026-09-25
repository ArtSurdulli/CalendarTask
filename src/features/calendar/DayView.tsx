import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { categoryColors, colors, radius, shadows, spacing } from '../../theme';
import { eventStartsBeforeDay, formatEventTimeRange } from './dateUtils';
import type { CalendarEvent } from '../../types';

export interface DayViewProps {
  day: Date;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
  onCreate: () => void;
}

/**
 * Presentational day view: a fixed date header above a scrollable list of
 * that day's events (or an empty state). No store access - `day` and
 * `events` are fully controlled by the parent.
 */
export function DayView({ day, events, onSelectEvent, onCreate }: DayViewProps) {
  const sortedEvents = [...events].sort(
    (a, b) => parseISO(a.startsAt).getTime() - parseISO(b.startsAt).getTime(),
  );
  const count = sortedEvents.length;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {format(day, 'EEEE, MMMM d, yyyy')} · {count} event{count === 1 ? '' : 's'}
      </Text>

      {sortedEvents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No events on this day.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add event"
            onPress={onCreate}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Add event</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sortedEvents.map((event) => (
            <EventRow key={event.id} event={event} day={day} onPress={onSelectEvent} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

interface EventRowProps {
  event: CalendarEvent;
  /** The day being listed - decides whether the event is continuing into it. */
  day: Date;
  onPress: (id: string) => void;
}

function EventRow({ event, day, onPress }: EventRowProps) {
  // An event that began on an earlier day keeps its real start, with that
  // day's date, e.g. "Thu Sep 25, 8:00 PM – 1:00 AM".
  const timeRange = formatEventTimeRange(event, day);
  const continuedFrom = eventStartsBeforeDay(event, day)
    ? format(parseISO(event.startsAt), 'EEEE')
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        continuedFrom
          ? `${event.title}, ${timeRange}, continued from ${continuedFrom}`
          : `${event.title}, ${timeRange}`
      }
      onPress={() => onPress(event.id)}
      style={[styles.row, shadows.card, { borderLeftColor: categoryColors[event.category] }]}
    >
      {continuedFrom ? (
        <Text style={styles.rowContinued}>{`Continued from ${continuedFrom}`}</Text>
      ) : null}
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.rowTime}>{timeRange}</Text>
      </View>
      {event.description ? (
        <Text style={styles.rowNotes} numberOfLines={1} ellipsizeMode="tail">
          {event.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 15,
    color: colors.textPrimary,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  rowTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowContinued: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  rowNotes: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
