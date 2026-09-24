import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { EventFormScreen } from '../features/events/EventFormScreen';

export type CalendarStackParamList = {
  CalendarHome: undefined;
  /**
   * `date`: local ISO string (see dateUtils) of the day to default a new
   * event onto. Ignored when `eventId` is present.
   */
  EventForm: { eventId?: string; date?: string } | undefined;
};

const Stack = createNativeStackNavigator<CalendarStackParamList>();

export function CalendarNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CalendarHome" component={CalendarScreen} />
      <Stack.Screen
        name="EventForm"
        component={EventFormScreen}
        options={({ route }) => ({
          headerShown: true,
          presentation: 'modal',
          title: route.params?.eventId ? 'Edit event' : 'New event',
        })}
      />
    </Stack.Navigator>
  );
}
