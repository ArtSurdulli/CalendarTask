import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { EventFormScreen } from '../features/events/EventFormScreen';
import { useReduceMotion } from '../app/useReduceMotion';
import { modalAnimation, pushAnimation } from './stackAnimations';

export type CalendarStackParamList = {
  CalendarHome: undefined;
  /**
   * `date`: local ISO string (see dateUtils) of the day to default a new
   * event onto; only its date is used. `hour`: explicit start hour (0-23)
   * for a new event - when omitted, it defaults to the next round hour.
   * Both are ignored when `eventId` is present.
   */
  EventForm: { eventId?: string; date?: string; hour?: number } | undefined;
};

const Stack = createNativeStackNavigator<CalendarStackParamList>();

export function CalendarNavigator() {
  const reduceMotion = useReduceMotion();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, ...pushAnimation(reduceMotion) }}>
      <Stack.Screen name="CalendarHome" component={CalendarScreen} />
      <Stack.Screen
        name="EventForm"
        component={EventFormScreen}
        options={({ route }) => ({
          headerShown: true,
          presentation: 'modal',
          ...modalAnimation(reduceMotion),
          title: route.params?.eventId ? 'Edit event' : 'New event',
        })}
      />
    </Stack.Navigator>
  );
}
