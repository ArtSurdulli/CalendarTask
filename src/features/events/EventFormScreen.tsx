import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { parseISO } from 'date-fns';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FormField } from '../../components/FormField';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { createEvent, deleteEvent, selectEventItems, updateEvent } from './eventsSlice';
import { toLocalISOString } from '../calendar/dateUtils';
import { defaultStartAndEnd } from './eventDefaults';
import { categoryColors, categoryColorsTint, colors, radius, shadows, spacing } from '../../theme';
import { EVENT_CATEGORIES, type EventCategory } from '../../types';
import type { CalendarStackParamList } from '../../navigation/CalendarNavigator';

const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    notes: z.string().trim().optional(),
    category: z.enum(EVENT_CATEGORIES),
    startsAt: z.date(),
    endsAt: z.date(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'End must be after start',
    path: ['endsAt'],
  });

type EventFormValues = z.infer<typeof eventFormSchema>;

type Props = NativeStackScreenProps<CalendarStackParamList, 'EventForm'>;

export function EventFormScreen({ navigation, route }: Props) {
  const dispatch = useAppDispatch();
  const eventId = route.params?.eventId;
  const defaultDay = route.params?.date ? parseISO(route.params.date) : undefined;
  const defaultHour = route.params?.hour;

  const user = useAppSelector((state) => state.auth.user);
  const items = useAppSelector(selectEventItems);
  const status = useAppSelector((state) => state.events.status);
  const formError = useAppSelector((state) => state.events.error);
  const isSubmitting = status === 'loading';

  const existingEvent = eventId ? items.find((event) => event.id === eventId) : undefined;
  const isEditing = Boolean(eventId);

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: existingEvent
      ? {
          title: existingEvent.title,
          notes: existingEvent.description ?? '',
          category: existingEvent.category,
          startsAt: parseISO(existingEvent.startsAt),
          endsAt: parseISO(existingEvent.endsAt),
        }
      : { title: '', notes: '', category: 'other', ...defaultStartAndEnd(defaultDay, defaultHour) },
  });

  /**
   * Moving the start preserves the existing duration only when leaving
   * the end alone would otherwise make it invalid (at or before the new
   * start) - shift it by the same delta so the gap is unchanged. A
   * still-valid, later end the user explicitly set is left alone.
   * Changing the end directly (its own field, below) never touches this.
   */
  const handleStartsAtChange = (newStart: Date) => {
    const previousStart = getValues('startsAt');
    const currentEnd = getValues('endsAt');
    const delta = newStart.getTime() - previousStart.getTime();

    setValue('startsAt', newStart, { shouldValidate: true, shouldDirty: true });

    if (currentEnd.getTime() <= newStart.getTime()) {
      setValue('endsAt', new Date(currentEnd.getTime() + delta), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const onSubmit = (values: EventFormValues) => {
    if (isEditing && existingEvent) {
      dispatch(
        updateEvent({
          id: existingEvent.id,
          userId: existingEvent.userId,
          title: values.title,
          description: values.notes || undefined,
          category: values.category,
          startsAt: toLocalISOString(values.startsAt),
          endsAt: toLocalISOString(values.endsAt),
          allDay: existingEvent.allDay,
        }),
      ).then((result) => {
        if (updateEvent.fulfilled.match(result)) {
          navigation.goBack();
        }
      });
      return;
    }

    if (!user) {
      return;
    }

    dispatch(
      createEvent({
        userId: user.id,
        title: values.title,
        description: values.notes || undefined,
        category: values.category,
        startsAt: toLocalISOString(values.startsAt),
        endsAt: toLocalISOString(values.endsAt),
      }),
    ).then((result) => {
      if (createEvent.fulfilled.match(result)) {
        navigation.goBack();
      }
    });
  };

  const handleDelete = () => {
    if (!existingEvent) {
      return;
    }

    Alert.alert(
      'Delete event',
      `Delete "${existingEvent.title}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dispatch(deleteEvent(existingEvent.id)).then((result) => {
              if (deleteEvent.fulfilled.match(result)) {
                navigation.goBack();
              }
            });
          },
        },
      ],
    );
  };

  if (eventId && !existingEvent) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.container}>
          <Text style={styles.notFound}>This event could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, shadows.card]}>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="Title"
                accessibilityLabel="Title"
                variant="card"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.title?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <FormField
                label="Notes"
                accessibilityLabel="Notes"
                variant="card"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.notes?.message}
                multiline
                placeholder="Optional"
              />
            )}
          />
        </View>

        <View style={[styles.card, shadows.card]}>
          <Text style={styles.label}>Category</Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { value, onChange } }) => (
              <CategoryPicker value={value} onChange={onChange} />
            )}
          />
        </View>

        <View style={[styles.card, shadows.card]}>
          <Controller
            control={control}
            name="startsAt"
            render={({ field: { value } }) => (
              <DateTimeField
                label="Starts"
                accessibilityLabelPrefix="Start"
                value={value}
                onChange={handleStartsAtChange}
                error={errors.startsAt?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="endsAt"
            render={({ field: { value, onChange } }) => (
              <DateTimeField
                label="Ends"
                accessibilityLabelPrefix="End"
                value={value}
                onChange={onChange}
                error={errors.endsAt?.message}
                isLast
              />
            )}
          />
        </View>
      </ScrollView>

      {/*
        Fixed footer: a normal flex sibling below the ScrollView (not an
        absolute overlay), so it reserves its own space and can never
        cover the scroll content - `container`'s extra bottom padding is
        just breathing room, not overlap insurance.
      */}
      <View style={styles.footer}>
        {formError ? (
          <Text
            style={styles.formError}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {formError}
          </Text>
        ) : null}

        {isEditing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete event"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={handleDelete}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>Delete event</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Save changes' : 'Create event'}
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting
              ? 'Saving…'
              : isEditing
                ? 'Save changes'
                : 'Create event'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface DateTimeFieldProps {
  label: string;
  accessibilityLabelPrefix: string;
  value: Date;
  onChange: (date: Date) => void;
  error?: string;
  isLast?: boolean;
}

function DateTimeField({
  label,
  accessibilityLabelPrefix,
  value,
  onChange,
  error,
  isLast,
}: DateTimeFieldProps) {
  const handleDateChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    const merged = new Date(value);
    merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onChange(merged);
  };

  const handleTimeChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    const merged = new Date(value);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(merged);
  };

  return (
    <View style={[styles.dateTimeFieldContainer, isLast && styles.dateTimeFieldContainerLast]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateTimeRow}>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          onValueChange={handleDateChange}
          accessibilityLabel={`${accessibilityLabelPrefix} date`}
          style={styles.datePicker}
        />
        <DateTimePicker
          value={value}
          mode="time"
          display="compact"
          onValueChange={handleTimeChange}
          accessibilityLabel={`${accessibilityLabelPrefix} time`}
          style={styles.timePicker}
        />
      </View>
      {error ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface CategoryPickerProps {
  value: EventCategory;
  onChange: (category: EventCategory) => void;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <View style={styles.categoryRow}>
      {EVENT_CATEGORIES.map((category) => {
        const isSelected = category === value;
        const label = capitalize(category);
        const backgroundColor = isSelected ? categoryColors[category] : categoryColorsTint[category];

        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(category)}
            style={[styles.categoryChip, { backgroundColor }]}
          >
            <Text
              style={[
                styles.categoryChipText,
                { color: isSelected ? colors.onPrimary : colors.textPrimary },
                isSelected && styles.categoryChipTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  notFound: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    fontWeight: '700',
  },
  dateTimeFieldContainer: {
    marginBottom: spacing.md,
  },
  dateTimeFieldContainerLast: {
    marginBottom: 0,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePicker: {
    marginRight: spacing.md,
  },
  timePicker: {},
  error: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.danger,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  formError: {
    color: colors.danger,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
