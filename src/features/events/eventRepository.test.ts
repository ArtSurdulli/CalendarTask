import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventRepository } from './eventRepository';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest').default,
);

// Mirrors the private EVENTS_KEY in eventRepository.ts - there's no
// public way to seed "data already on disk" without it.
const EVENTS_KEY = '@events/events';

beforeEach(async () => {
  // The mock module is a singleton the repository already holds a
  // reference to, so clearing it in place (rather than
  // clearAllMockStorages(), which only resets the registry a *future*
  // require() would see) is what actually isolates each test.
  await AsyncStorage.clear();
});

describe('eventRepository', () => {
  test('create stores and returns the given category', async () => {
    const created = await eventRepository.create({
      userId: 'user-1',
      title: 'Standup',
      category: 'work',
      startsAt: '2023-10-15T09:00:00',
      endsAt: '2023-10-15T09:30:00',
    });

    expect(created.category).toBe('work');

    const listed = await eventRepository.listForUser('user-1');
    expect(listed).toEqual([created]);
  });

  test('update replaces the category along with the rest of the event', async () => {
    const created = await eventRepository.create({
      userId: 'user-1',
      title: 'Standup',
      category: 'work',
      startsAt: '2023-10-15T09:00:00',
      endsAt: '2023-10-15T09:30:00',
    });

    const updated = await eventRepository.update({ ...created, category: 'personal' });

    expect(updated.category).toBe('personal');
    const [listed] = await eventRepository.listForUser('user-1');
    expect(listed.category).toBe('personal');
  });

  test('an event stored without a category reads back as "other"', async () => {
    // Simulates a record written before `category` existed - bypasses
    // the repository's own (category-requiring) create() to write JSON
    // shaped the way pre-migration data would actually be on disk.
    const legacyEvent = {
      id: 'legacy-1',
      userId: 'user-1',
      title: 'Old event',
      startsAt: '2023-10-15T09:00:00',
      endsAt: '2023-10-15T09:30:00',
    };
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify([legacyEvent]));

    const listed = await eventRepository.listForUser('user-1');

    expect(listed).toHaveLength(1);
    expect(listed[0].category).toBe('other');
  });

  test('a legacy event without a category can still be updated', async () => {
    const legacyEvent = {
      id: 'legacy-1',
      userId: 'user-1',
      title: 'Old event',
      startsAt: '2023-10-15T09:00:00',
      endsAt: '2023-10-15T09:30:00',
    };
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify([legacyEvent]));

    const [normalized] = await eventRepository.listForUser('user-1');
    const updated = await eventRepository.update({ ...normalized, title: 'Renamed' });

    expect(updated.category).toBe('other');
    expect(updated.title).toBe('Renamed');
  });
});
