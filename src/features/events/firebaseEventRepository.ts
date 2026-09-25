/**
 * Cloud Firestore implementation of EventRepository.
 *
 * Selected over the local implementation by `USE_FIREBASE` (src/config.ts);
 * nothing outside src/app/repositories.ts knows which one is live.
 *
 * Events live in the top-level `events` collection, one document per
 * event, with the owner's uid in `userId`. Every read is scoped to the
 * signed-in user's uid.
 *
 * `startsAt`/`endsAt` are stored exactly as the app produces them: local
 * wall-clock ISO strings from `toLocalISOString`, as plain strings - never
 * Firestore Timestamps, which are UTC instants and would reintroduce the
 * day-shifting the calendar's date logic is built to avoid.
 */
import { getAuth } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
  type DocumentData,
} from '@react-native-firebase/firestore';
import type { EventRepository, NewEventInput } from './eventRepository';
import type { CalendarEvent } from '../../types';

const EVENTS_COLLECTION = 'events';

function eventsCollection() {
  return collection(getFirestore(), EVENTS_COLLECTION);
}

function signedInUid(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('You need to be signed in to do that.');
  }
  return uid;
}

/** The stored fields: everything but `id`, which is the document id. */
function toDocument(event: NewEventInput): DocumentData {
  const data: DocumentData = {
    userId: event.userId,
    title: event.title,
    category: event.category,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
  };
  // Firestore rejects `undefined` field values, so optional fields are
  // only written when set.
  if (event.description !== undefined) {
    data.description = event.description;
  }
  if (event.allDay !== undefined) {
    data.allDay = event.allDay;
  }
  return data;
}

function toEvent(id: string, data: DocumentData): CalendarEvent {
  return {
    id,
    userId: data.userId,
    title: data.title,
    description: data.description,
    category: data.category ?? 'other',
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    allDay: data.allDay,
  };
}

/** The event with `id` if it exists and belongs to `uid`, else null. */
async function findOwnedEvent(id: string, uid: string): Promise<CalendarEvent | null> {
  const snapshot = await getDoc(doc(eventsCollection(), id));
  const data = snapshot.exists() ? snapshot.data() : undefined;
  return data && data.userId === uid ? toEvent(snapshot.id, data) : null;
}

class FirebaseEventRepository implements EventRepository {
  async listForUser(userId: string): Promise<CalendarEvent[]> {
    const uid = signedInUid();
    if (userId !== uid) {
      return [];
    }
    const snapshot = await getDocs(query(eventsCollection(), where('userId', '==', uid)));
    return snapshot.docs.map((document) => toEvent(document.id, document.data()));
  }

  async create(input: NewEventInput): Promise<CalendarEvent> {
    const uid = signedInUid();
    if (input.userId !== uid) {
      throw new Error('Event not found.');
    }
    const reference = await addDoc(eventsCollection(), toDocument(input));
    return { ...input, id: reference.id };
  }

  async update(event: CalendarEvent): Promise<CalendarEvent> {
    const uid = signedInUid();
    if (event.userId !== uid || !(await findOwnedEvent(event.id, uid))) {
      throw new Error('Event not found.');
    }
    await setDoc(doc(eventsCollection(), event.id), toDocument(event));
    return event;
  }

  async remove(id: string): Promise<void> {
    const uid = signedInUid();
    // Like the local repository, removing an event that isn't there (or
    // isn't yours) is a no-op rather than an error.
    if (await findOwnedEvent(id, uid)) {
      await deleteDoc(doc(eventsCollection(), id));
    }
  }
}

export const firebaseEventRepository: EventRepository = new FirebaseEventRepository();
