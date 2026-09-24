# CalendarTask

## Overview

CalendarTask is a React Native (bare CLI) take-home app: email/password auth with optional
Face ID/Touch ID unlock, and a custom month-grid and day-view calendar for creating, editing,
and deleting categorized events, all scoped per signed-in user. There is no backend — auth and
events are persisted locally on-device, behind repository interfaces designed as the swap point
for a real API.

## Versions this was built and verified against

- React Native 0.84.0
- Node v22.23.1
- Xcode 26.5
- CocoaPods 1.17.0
- iOS 26.5 simulator
- macOS 26.6.2

## Setup

```
git clone <repo-url>
cd CalendarTask
npm install
cd ios && pod install && cd ..
```

Start Metro in one terminal:

```
npm start
```

Then, in a second terminal, build and run on the simulator:

```
npx react-native run-ios --simulator="iPhone 17 Pro"
```

(`npm run ios` also works if a simulator is already booted; the flag above just pins the device.)

There is no seeded account. On first launch you land on the sign-up/login screen and create an
account yourself — it's stored locally, so it only exists on that install.

## Architecture

The app is organized by feature, not by file type:

```
src/
  app/          Redux store + typed hooks
  components/   shared UI (FormField)
  features/
    auth/       authRepository, biometricRepository, authSlice, Login/SignUp/Unlock screens
    calendar/   dateUtils, MonthGrid, DayView, CalendarScreen
    events/     eventRepository, eventsSlice, EventFormScreen
    profile/    ProfileScreen
  navigation/   Auth/Calendar/App/Root navigators
  theme/        colors, spacing, radius, category colors, shadows
  types/        User, CalendarEvent, EventCategory
```

**Repository pattern.** `authRepository.ts` and `eventRepository.ts` are the only files
allowed to import AsyncStorage directly. Everything else — screens, Redux slices — talks to
them only through their exported interface (`AuthRepository`, `EventRepository`). This is the
documented swap point for a real backend: replacing local persistence with HTTP calls to an API
means rewriting these two files and nothing else. `biometricRepository.ts` follows the same
rule for react-native-keychain.

**State.** Redux Toolkit, one slice per feature (`authSlice`, `eventsSlice`), each with
`createAsyncThunk` thunks that call into the repository layer and plain `idle`/`loading` status
plus an `error` string. Selectors (e.g. `selectEventsForDay`, `selectEventCountsByDayForMonth`)
are memoized with `createSelector`.

**MonthGrid and DayView are presentational.** Neither imports `react-redux` or touches the
store; both take everything they render as props from `CalendarScreen`, which owns the
connected state. This was a deliberate constraint kept throughout the build, not an accident of
how the code happened to end up.

## Calendar implementation

The month grid and day view are built from scratch — no third-party calendar library. All the
date math lives in `src/features/calendar/dateUtils.ts` as pure functions (no React, no Redux),
covered by their own Jest tests.

The grid is not a fixed six rows. `getMonthGrid` spans from the Monday of the week containing
the 1st of the month to the Sunday of the week containing the last day, so a month renders as
exactly the 4, 5, or 6 rows it needs (e.g. February 2027 is 4 rows with no out-of-month
padding; October 2023 is 6). A `MAX_CALENDAR_ROWS` constant is exported separately for screens
that want a fixed-height layout regardless of which month is showing.

All date handling is local-time only. Event timestamps (`CalendarEvent.startsAt`/`endsAt`) are
stored as ISO strings *without* a UTC offset or `Z` suffix, so `date-fns`'s `parseISO` reads
them back as local wall-clock time instead of shifting across a day boundary on parse.
`toLocalISOString` (also in `dateUtils.ts`) is the single sanctioned way to turn a `Date` into
that stored string — `Date#toISOString` is never used for this anywhere in the app, since it
converts to UTC and can land an event on the wrong calendar day near midnight.

## Biometrics

Enabling Face ID/Touch ID stores the user's credentials in the Keychain
(`biometricRepository.ts`) with `accessControl: BIOMETRY_CURRENT_SET`. This matters: it means
the entry invalidates itself if the user enrols a new face or fingerprint, rather than silently
staying valid for whatever biometry happens to be on the device at the time it's read.

Unlock is user-initiated, not automatic. On launch, if a biometric credential exists and no
session is active, the app shows an unlock screen with a "Use Face ID" button rather than
firing the OS prompt immediately — an unprompted system dialog on cold start is disorienting,
and the password form is always one tap away as a fallback.

## Known limitations

- The local repositories are a mock backend for this exercise, not a production auth/data
  layer.
- Passwords are stored unhashed in AsyncStorage, and AsyncStorage itself is not encrypted at
  rest. A real implementation would never store a password client-side at all — after sign-in
  it would keep a refresh token in the Keychain instead, and biometric unlock would exchange
  that token for a fresh session rather than replaying a password.
- Events store local wall-clock time only (no UTC value, no IANA timezone id alongside it). An
  event created while traveling, or shared across timezones, has no way to know which timezone
  it was meant for.

## Testing

```
npm test
```

48 tests across 5 suites, all passing:

- `dateUtils.test.ts` (21) — the pure calendar functions: grid generation across
  Sunday/Monday-start months, leap and non-leap Februaries, December→January rollover, month
  navigation, same-day comparison, event-day filtering, local-ISO round-tripping, and day-key
  generation.
- `authSlice.test.ts` (12) — sign-in/sign-up/sign-out, biometric enrollment (including that a
  wrong password never reaches the Keychain, and that a cancelled Face ID prompt is treated as
  a normal outcome, not an error), and the enrollment-offer eligibility logic.
- `eventsSlice.test.ts` (10) — create/update/delete reducers, the day and month selectors, and
  a rejected-thunk error case.
- `eventRepository.test.ts` (4) — event persistence, including that an event saved before the
  category field existed reads back as `other` instead of breaking.
- `App.test.tsx` (1) — smoke test that the full app tree renders.

## What I'd add next

- An agenda view: upcoming events grouped by day with collapsible sections, as an alternative
  to paging through the month grid one day at a time.
- An app-lock layer that re-authenticates on foreground after a timeout, the way banking apps
  do, rather than only gating the initial launch.
- Android verification — this was built and tested exclusively against the iOS simulator; none
  of it has been run on Android.

## A note on Firebase

Firebase was attempted first and dropped. The Firestore pod pulls in gRPC, which fails to build
a module map under Xcode 26's clang. Rather than fight the build toolchain, the data layer was
put behind the repository interfaces described above, so a real backend — Firebase or otherwise
— can be swapped in later without touching the UI or Redux layers.
