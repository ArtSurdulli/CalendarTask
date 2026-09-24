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

/**
 * Presentational hour-by-hour day schedule (00:00-23:00). No store access -
 * `day` and `events` are fully controlled by the parent. Tapping an empty
 * hour calls `onCreate` with that hour; tapping an event block calls
 * `onSelectEvent` instead - the event blocks are separate touch targets
 * layered on top, so they intercept the tap before it reaches the row
 * underneath.
 */
export function DayScheduleView({ day, events, onSelectEvent, onCreate }: DayScheduleViewProps) {
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
          </Pressable>
        ))}

        <View style={styles.eventsLayer} pointerEvents="box-none">
          {laidOutEvents.map(({ event, top, height, leftPercent, widthPercent }) => {
            const timeRange = `${format(parseISO(event.startsAt), 'h:mm a')} – ${format(
              parseISO(event.endsAt),
              'h:mm a',
            )}`;

            return (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                accessibilityLabel={`${event.title}, ${timeRange}`}
                onPress={() => onSelectEvent(event.id)}
                style={[
                  styles.eventBlock,
                  {
                    top,
                    height,
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: categoryColorsTint[event.category],
                    borderLeftColor: categoryColors[event.category],
                  },
                ]}
              >
                <Text style={styles.eventBlockTitle} numberOfLines={2} ellipsizeMode="tail">
                  {event.title}
                </Text>
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

interface TimedEvent {
  event: CalendarEvent;
  start: number;
  end: number;
}

interface LaidOutEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Positions events by start time and duration, splitting the width evenly
 * among events that overlap in time (a standard greedy column-assignment
 * layout: events are swept in start order, each claiming the first column
 * whose previous occupant has already ended).
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
  let cluster: TimedEvent[] = [];
  let clusterEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) {
      return;
    }

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

    const totalColumns = columnEnds.length;
    cluster.forEach((item, index) => {
      const column = columnByItem[index];
      laidOut.push({
        event: item.event,
        top: item.start * PX_PER_MINUTE,
        height: Math.max((item.end - item.start) * PX_PER_MINUTE, MIN_EVENT_HEIGHT),
        leftPercent: (column / totalColumns) * 100,
        widthPercent: 100 / totalColumns,
      });
    });

    cluster = [];
  };

  for (const item of timed) {
    if (cluster.length > 0 && item.start >= clusterEnd) {
      flushCluster();
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flushCluster();

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
    marginRight: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  eventsLayer: {
    position: 'absolute',
    top: 0,
    left: HOUR_LABEL_WIDTH,
    right: spacing.md,
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
});
