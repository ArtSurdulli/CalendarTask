/**
 * The one place that chooses a backend. Slices import their repositories
 * from here and only ever see the `AuthRepository`/`EventRepository`
 * interfaces, so nothing else in the app knows which backend is live.
 */
import { USE_FIREBASE } from '../config';
import {
  authRepository as localAuthRepository,
  type AuthRepository,
} from '../features/auth/authRepository';
import { firebaseAuthRepository } from '../features/auth/firebaseAuthRepository';
import {
  eventRepository as localEventRepository,
  type EventRepository,
} from '../features/events/eventRepository';
import { firebaseEventRepository } from '../features/events/firebaseEventRepository';

export const authRepository: AuthRepository = USE_FIREBASE
  ? firebaseAuthRepository
  : localAuthRepository;

export const eventRepository: EventRepository = USE_FIREBASE
  ? firebaseEventRepository
  : localEventRepository;
