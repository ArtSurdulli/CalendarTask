import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import {
  CALENDAR_COLUMNS,
  CalendarDayCell,
  MAX_CALENDAR_ROWS,
  getMonthGrid,
  isSameCalendarDay,
  toDayKey,
} from './dateUtils';
import { categoryColors, colors, radius, spacing } from '../../theme';
import type { EventCategory } from '../../types';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Minimum touch target per accessibility guidance (iOS HIG, WCAG 2.1). */
const MIN_TOUCH_TARGET = 44;

/** More than this many distinct categories on a day still shows only this many dots. */
const MAX_CATEGORY_DOTS = 3;

export interface MonthGridProps {
  month: Date;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  /**
   * Event count per day, keyed by `toDayKey` (`yyyy-MM-dd`, local time).
   * Optional and purely presentational - the grid never reads the store
   * itself, the parent hands it whatever counts it wants shown.
   */
  eventCountsByDay?: Map<string, number>;
  /**
   * Distinct categories present on each day, same key format as
   * `eventCountsByDay`. Drives the row of category dots under the day
   * number - also purely presentational.
   */
  eventCategoriesByDay?: Map<string, EventCategory[]>;
}

/**
 * Presentational month grid. Owns no domain state - `month` and
 * `selectedDay` are fully controlled by the parent. The only local state
 * is the measured container width used to compute equal-width columns.
 */
export function MonthGrid({
  month,
  selectedDay,
  onSelectDay,
  eventCountsByDay,
  eventCategoriesByDay,
}: MonthGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const cellSize = containerWidth / CALENDAR_COLUMNS;
  const gridHeight = cellSize * MAX_CALENDAR_ROWS;
  const { cells } = getMonthGrid(month);

  return (
    <View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/*
        Fixed at MAX_CALENDAR_ROWS * cellHeight regardless of how many
        rows this particular month needs, so paging between a 4-row and a
        6-row month never shifts surrounding layout - short months just
        leave blank space at the bottom.
      */}
      <View
        style={[styles.grid, containerWidth > 0 && { height: gridHeight }]}
        onLayout={handleLayout}
      >
        {containerWidth > 0 &&
          cells.map((cell) => {
            const dayKey = toDayKey(cell.date);
            return (
              <DayCell
                key={dayKey}
                cell={cell}
                size={cellSize}
                isSelected={isSameCalendarDay(cell.date, selectedDay)}
                eventCount={eventCountsByDay?.get(dayKey) ?? 0}
                categories={eventCategoriesByDay?.get(dayKey) ?? []}
                onPress={onSelectDay}
              />
            );
          })}
      </View>
    </View>
  );
}

interface DayCellProps {
  cell: CalendarDayCell;
  size: number;
  isSelected: boolean;
  eventCount: number;
  categories: EventCategory[];
  onPress: (date: Date) => void;
}

function DayCell({ cell, size, isSelected, eventCount, categories, onPress }: DayCellProps) {
  const { date, isCurrentMonth, isToday } = cell;
  const badgeSize = Math.min(size - spacing.sm, size * 0.78);
  const hasEvents = eventCount > 0;
  const visibleCategories = categories.slice(0, MAX_CATEGORY_DOTS);

  const dateLabel = format(date, 'EEEE, MMMM d, yyyy');
  const accessibilityLabel = hasEvents
    ? `${dateLabel}, ${eventCount} event${eventCount === 1 ? '' : 's'}`
    : dateLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isSelected }}
      onPress={() => onPress(date)}
      style={[
        styles.dayCell,
        {
          width: size,
          height: size,
          minWidth: MIN_TOUCH_TARGET,
          minHeight: MIN_TOUCH_TARGET,
        },
      ]}
    >
      <View style={styles.dayCellContent}>
        {isToday || isSelected ? (
          <View
            style={[
              styles.dayBadge,
              {
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
              },
              isToday && styles.dayBadgeToday,
              // Selected fill takes precedence but the today ring, on a
              // separate property (border vs background), still reads
              // clearly around it when both apply.
              isSelected && styles.dayBadgeSelected,
            ]}
          >
            <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
              {date.getDate()}
            </Text>
          </View>
        ) : (
          // Ordinary days: a bare number, no badge/circle treatment.
          <Text style={[styles.dayText, !isCurrentMonth && styles.dayTextMuted]}>
            {date.getDate()}
          </Text>
        )}

        {hasEvents ? (
          <View style={styles.categoryDotsRow}>
            {visibleCategories.map((category) => (
              <View
                key={category}
                style={[styles.categoryDot, { backgroundColor: categoryColors[category] }]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  weekdayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayBadgeToday: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  dayBadgeSelected: {
    backgroundColor: colors.textPrimary,
  },
  dayText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  dayTextMuted: {
    color: colors.textMuted,
  },
  dayTextSelected: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  categoryDotsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    gap: 3,
  },
  categoryDot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.full,
  },
});
