import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { categoryColors, categoryColorsTint, colors, radius, spacing } from '../../theme';
import type { CalendarEvent } from '../../types';

export interface DayScheduleViewProps {
  day: Date;
  events: CalendarEvent[];
  onSelectEvent: (id: string) => void;
  onCreate: (hour: number) => void;
  /** Tapping a collapsed "+N" block - shows the whole day's event list. */
  onShowDayEvents: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES_IN_DAY = 24 * 60;

/** Pixels per minute - also defines each hour row's height (60 * this). */
const PX_PER_MINUTE = 1;
const HOUR_HEIGHT = 60 * PX_PER_MINUTE;
/** Scrolled here on first render rather than midnight - most days' first
 * events are well after 00:00, so this starts the view somewhere useful. */
const INITIAL_SCROLL_HOUR = 8;
/** Events shorter than this still get a legible, tappable block. */
const MIN_EVENT_HEIGHT = 32;
const HOUR_LABEL_WIDTH = 52;
/** Right inset for hour lines and events - the screen's horizontal padding. */
const CONTENT_RIGHT_INSET = spacing.lg;
/**
 * Most side-by-side columns an overlapping group is split into. Past this,
 * concurrent events collapse into the last column as a "+N" block.
 */
const MAX_COLUMNS = 4;

/**
 * Presentational hour-by-hour day schedule (00:00-23:00). No store access -
 * `day` and `events` are fully controlled by the parent. Tapping an empty
 * hour calls `onCreate` with that hour; tapping an event block calls
 * `onSelectEvent` instead - the event blocks are separate touch targets
 * layered on top, so they intercept the tap before it reaches the row
 * underneath. A collapsed "+N" block calls `onShowDayEvents`.
 */
export function DayScheduleView({
  day,
  events,
  onSelectEvent,
  onCreate,
  onShowDayEvents,
}: DayScheduleViewProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Not animated: this is the view's starting position, not a user-visible
    // scroll action.
    scrollRef.current?.scrollTo({ y: INITIAL_SCROLL_HOUR * HOUR_HEIGHT, animated: false });
  }, [day]);

  const laidOutEvents = layoutEvents(events);

  return (
    <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        {HOURS.map((hour) => (
          <Pressable
            key={hour}
            accessibilityRole="button"
            accessibilityLabel={`Add event at ${formatHourLabel(hour)}`}
            onPress={() => onCreate(hour)}
            style={styles.hourRow}
          >
            <Text style={styles.hourLabel}>{formatHourLabel(hour)}</Text>
            <View style={styles.hourLine} />
            {/* Decorative only - touches fall through to the hour row. */}
            <View style={styles.halfHourLine} pointerEvents="none" />
          </Pressable>
        ))}

        <View style={styles.eventsLayer} pointerEvents="box-none">
          {laidOutEvents.map((block) => {
            const [event] = block.events;
            const hiddenCount = block.events.length - 1;
            const isCollapsed = hiddenCount > 0;
            const eventLabel = `${event.title}, ${formatTimeRange(event)}`;

            return (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={
                  isCollapsed
                    ? `${eventLabel}, and ${hiddenCount} more event${hiddenCount === 1 ? '' : 's'}`
                    : eventLabel
                }
                accessibilityHint={isCollapsed ? "Shows the day's event list" : undefined}
                onPress={isCollapsed ? onShowDayEvents : () => onSelectEvent(event.id)}
                style={[
                  styles.eventBlock,
                  {
                    top: block.top,
                    height: block.height,
                    left: `${block.leftPercent}%`,
                    width: `${block.widthPercent}%`,
                    backgroundColor: categoryColorsTint[event.category],
                    borderLeftColor: categoryColors[event.category],
                  },
                ]}
              >
                <Text style={styles.eventBlockTitle} numberOfLines={2} ellipsizeMode="tail">
                  {event.title}
                </Text>
                {isCollapsed ? (
                  <Text style={styles.moreIndicator}>{`+${hiddenCount}`}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function formatHourLabel(hour: number): string {
  return format(new Date(2000, 0, 1, hour), 'h a');
}

function formatTimeRange(event: CalendarEvent): string {
  return `${format(parseISO(event.startsAt), 'h:mm a')} – ${format(parseISO(event.endsAt), 'h:mm a')}`;
}

interface TimedEvent {
  event: CalendarEvent;
  start: number;
  end: number;
}

/**
 * One block on screen: a single event, or - in the last column of a group
 * wider than MAX_COLUMNS - several concurrent events collapsed together
 * (the first is shown, the rest counted as "+N").
 */
interface LaidOutEvent {
  events: CalendarEvent[];
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Splits start-sorted items into runs where each overlaps the run so far. */
function groupOverlapping(items: TimedEvent[]): TimedEvent[][] {
  const groups: TimedEvent[][] = [];
  let groupEnd = -1;
  for (const item of items) {
    if (groups.length === 0 || item.start >= groupEnd) {
      groups.push([]);
    }
    groups[groups.length - 1].push(item);
    groupEnd = Math.max(groupEnd, item.end);
  }
  return groups;
}

function toBlock(items: TimedEvent[], column: number, totalColumns: number): LaidOutEvent {
  const start = Math.min(...items.map((item) => item.start));
  const end = Math.max(...items.map((item) => item.end));
  return {
    events: items.map((item) => item.event),
    top: start * PX_PER_MINUTE,
    height: Math.max((end - start) * PX_PER_MINUTE, MIN_EVENT_HEIGHT),
    leftPercent: (column / totalColumns) * 100,
    widthPercent: 100 / totalColumns,
  };
}

/**
 * Positions events by start time and duration, splitting the width evenly
 * among events that overlap in time (a standard greedy column-assignment
 * layout: events are swept in start order, each claiming the first column
 * whose previous occupant has already ended).
 *
 * A group needing more than MAX_COLUMNS columns is drawn MAX_COLUMNS wide:
 * the first MAX_COLUMNS - 1 columns as usual, and every event from the
 * remaining columns in the last one. There, events that overlap each other
 * collapse into one "+N" block; one that overlaps nothing else in those
 * columns is still drawn on its own.
 */
function layoutEvents(events: CalendarEvent[]): LaidOutEvent[] {
  const timed: TimedEvent[] = events
    .map((event) => {
      const start = Math.max(0, minutesFromMidnight(parseISO(event.startsAt)));
      const rawEnd = minutesFromMidnight(parseISO(event.endsAt));
      // An end at exactly midnight reads as minute 0 - treat that (and any
      // other non-positive span) as running to the end of the day instead
      // of collapsing to zero height.
      const end = rawEnd > start ? Math.min(MINUTES_IN_DAY, rawEnd) : MINUTES_IN_DAY;
      return { event, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const laidOut: LaidOutEvent[] = [];

  for (const cluster of groupOverlapping(timed)) {
    const columnEnds: number[] = [];
    const columnByItem: number[] = [];

    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[column] = item.end;
      }
      columnByItem.push(column);
    }

    const totalColumns = Math.min(columnEnds.length, MAX_COLUMNS);
    const overflowColumn = MAX_COLUMNS - 1;
    const overflow: TimedEvent[] = [];

    cluster.forEach((item, index) => {
      const column = columnByItem[index];
      if (columnEnds.length > MAX_COLUMNS && column >= overflowColumn) {
        overflow.push(item);
      } else {
        laidOut.push(toBlock([item], column, totalColumns));
      }
    });

    // `cluster` is start-sorted, so `overflow` is too.
    for (const group of groupOverlapping(overflow)) {
      laidOut.push(toBlock(group, overflowColumn, totalColumns));
    }
  }

  return laidOut;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.lg,
  },
  grid: {
    position: 'relative',
  },
  hourRow: {
    flexDirection: 'row',
    height: HOUR_HEIGHT,
  },
  hourLabel: {
    width: HOUR_LABEL_WIDTH,
    paddingLeft: spacing.md,
    paddingTop: spacing.xs,
    fontSize: 12,
    color: colors.textSecondary,
  },
  hourLine: {
    flex: 1,
    marginRight: CONTENT_RIGHT_INSET,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  halfHourLine: {
    position: 'absolute',
    top: HOUR_HEIGHT / 2,
    left: HOUR_LABEL_WIDTH,
    right: CONTENT_RIGHT_INSET,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  eventsLayer: {
    position: 'absolute',
    top: 0,
    left: HOUR_LABEL_WIDTH,
    right: CONTENT_RIGHT_INSET,
    height: HOURS.length * HOUR_HEIGHT,
  },
  eventBlock: {
    position: 'absolute',
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  eventBlockTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  moreIndicator: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 2,
  },
});
