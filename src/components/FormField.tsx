import React, { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { makeStyles, radius, spacing, useTheme } from '../theme';

export interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Field-level validation message. Announced via accessibilityLiveRegion. */
  error?: string;
  accessibilityLabel: string;
  /**
   * 'card' gives a taller field with more inner padding, for forms laid
   * out on white cards (see EventFormScreen). Default matches the
   * original auth-screen sizing, unchanged for existing callers.
   */
  variant?: 'default' | 'card';
}

/** Labelled text input with an inline, screen-reader-announced error. */
export const FormField = forwardRef<TextInput, FormFieldProps>(
  ({ label, error, accessibilityLabel, variant = 'default', ...inputProps }, ref) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const isCard = variant === 'card';

    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            isCard && styles.inputCard,
            isCard && inputProps.multiline && styles.inputCardMultiline,
            error ? styles.inputError : null,
          ]}
          {...inputProps}
        />
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
  },
);

FormField.displayName = 'FormField';

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      minHeight: 44,
    },
    inputCard: {
      minHeight: 52,
      paddingVertical: spacing.md,
    },
    // Same resting height as a single-line card field (it inherits
    // `inputCard`'s minHeight and padding), so Title and Notes line up;
    // a multiline field still grows as more lines are typed.
    inputCardMultiline: {
      textAlignVertical: 'top',
    },
    inputError: {
      borderColor: colors.danger,
    },
    error: {
      marginTop: spacing.xs,
      fontSize: 13,
      color: colors.danger,
    },
  }),
);
