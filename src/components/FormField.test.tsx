import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FormField } from './FormField';

describe('FormField', () => {
  test('renders its visible label and an input with its accessibility label', () => {
    render(<FormField label="Email" accessibilityLabel="Email address" />);

    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email address')).toBeOnTheScreen();
  });

  test('shows no error message when not given one', () => {
    render(<FormField label="Email" accessibilityLabel="Email" />);

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  test('shows the error message as an alert when given one', () => {
    render(<FormField label="Email" accessibilityLabel="Email" error="Enter a valid email" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
  });

  test('passes value and text changes through to the input', () => {
    const onChangeText = jest.fn();
    render(
      <FormField
        label="Email"
        accessibilityLabel="Email"
        value="a@b.co"
        onChangeText={onChangeText}
      />,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveDisplayValue('a@b.co');

    fireEvent.changeText(input, 'new@example.com');

    expect(onChangeText).toHaveBeenCalledWith('new@example.com');
  });

  test('passes other TextInput props through', () => {
    const onBlur = jest.fn();
    render(
      <FormField label="Password" accessibilityLabel="Password" secureTextEntry onBlur={onBlur} />,
    );

    const input = screen.getByLabelText('Password');
    expect(input.props.secureTextEntry).toBe(true);

    fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
