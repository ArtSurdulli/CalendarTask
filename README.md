# CalendarTask

CalendarTask is a React Native (bare CLI) calendar app. Users sign up and sign in with email and
password, and can optionally unlock with Face ID or Touch ID. The calendar has a month grid, with
a list of the selected day's events below it, and an hour-by-hour day schedule. Events can be
created, edited and deleted, each with a title, notes, a start and end time, and one of five
categories (work, personal, health, social, other). A profile tab shows the account, a biometric
sign-in toggle, simple event statistics and sign-out. There is no server: accounts and events
are stored on the device, per user, behind repository interfaces that are the swap point for a
real backend.

## Versions

Built and verified against:

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

Then build and run on the simulator from a second terminal:

```
npm run ios
```

`npm run ios` runs `react-native run-ios`. To pick a specific simulator, pass it through, e.g.
`npm run ios -- --simulator="iPhone 17 Pro"`.

There is no seeded account. On first launch, create one from the sign-up screen. It is stored
locally, so it exists only on that install.

## Architecture

The code is organised by feature rather than by file type:

```
src/
  app/          Redux store, typed hooks, useReduceMotion
  components/   shared UI (FormField)
  features/
    auth/       authRepository, biometricRepository, authSlice, Login/SignUp/Unlock screens
    calendar/   dateUtils, MonthGrid, DayView, DayScheduleView, CalendarScreen
    events/     eventRepository, eventsSlice, eventDefaults, EventFormScreen
    profile/    ProfileScreen
  navigation/   root, auth, tab and calendar navigators; stack animation options
  theme/        colours, spacing, radius, category colours, shadows, motion
  types/        User, CalendarEvent, EventCategory
```

**Repository pattern.** Persistence sits behind two interfaces, `AuthRepository`
(`features/auth/authRepository.ts`) and `EventRepository` (`features/events/eventRepository.ts`).
Their implementations are the only files in `src/` that import AsyncStorage; screens and Redux
slices use the interfaces. The point is a single swap point per repository: moving to a real
backend means replacing each implementation file, without touching screens or state.
`biometricRepository.ts` applies the same rule to `react-native-keychain`: it is the only file
that imports it.

**State.** Redux Toolkit, with one slice per feature (`authSlice`, `eventsSlice`). Async work
goes through `createAsyncThunk` thunks that call the repositories. Derived data, such as events
for a day, per-day event counts and categories for a month, and the profile statistics, comes
from memoised `createSelector` selectors.

**Presentational components.** `MonthGrid`, `DayView` and `DayScheduleView` have no store
access; none of them imports `react-redux` or the app's store hooks. They render what they are
given as props and report taps through callbacks. `CalendarScreen` is the connected component
that reads the store and passes data down.

## Calendar implementation

The calendar is built from scratch, with no third-party calendar library. Date logic lives in
`src/features/calendar/dateUtils.ts` as pure functions with no React or Redux dependencies,
covered by their own tests.

**Variable row count.** Weeks start on Monday. `getMonthGrid` runs from the Monday of the week
containing the 1st to the Sunday of the week containing the last day, so a month has exactly the
4, 5 or 6 rows it needs rather than a forced six. For example, February 2027 is 4 rows and
October 2023 is 6. `MonthGrid` renders only those rows, but reserves the height of six
(`MAX_CALENDAR_ROWS`) so that moving between months doesn't shift the layout below it. Each week
is its own row of seven flexible cells, so the columns always divide the available width
exactly.

**Month and day views.** A Month/Day switch sits under the header. Month view shows the grid,
with category dots on days that have events, and the selected day's event list underneath. Day
view is an hour-by-hour schedule from 12 AM to 11 PM with half-hour dividers. Tapping an empty
hour starts a new event at that hour. The header arrows move by month or by day depending on
the view.

**Overlapping events.** In the day schedule, events that overlap in time are laid out side by
side in evenly split columns. The split is capped at four columns. Past that, the remaining
concurrent events collapse into the fourth column as a single block showing the first event and
a "+N" count. Tapping that block switches to Month view, where the day's full event list is
shown.

**Local wall-clock times.** `CalendarEvent.startsAt` and `endsAt` are ISO 8601 strings without a
UTC offset or `Z` suffix, e.g. `2026-09-23T14:00:00`. `date-fns`'s `parseISO` reads them back as
local time, so an event stays on the calendar day it was created on. `toLocalISOString` in
`dateUtils.ts` is the single sanctioned way to produce these strings from a `Date`.
`Date#toISOString` is not used anywhere in `src/`, because it converts to UTC and can move an
event onto the wrong day near midnight.

## Biometrics

Enabling Face ID or Touch ID stores the user's credentials in the iOS Keychain
(`biometricRepository.ts`), with `accessControl: BIOMETRY_CURRENT_SET` and
`accessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`. `BIOMETRY_CURRENT_SET` means the entry becomes
invalid if the user enrols a new face or fingerprint, rather than staying readable by whatever
biometry is enrolled at the time. Enabling biometrics from the profile screen asks for the
password again first, so a mistyped password is caught immediately instead of being stored and
failing later.

Unlock is user-initiated. When a biometric credential exists and there is no active session, the
app opens on an unlock screen with a "Use Face ID" button rather than firing the system prompt
straight away. A system dialog appearing unprompted on cold start is disorienting, and the
password form is always one tap away through "Use password instead".

## Animations

Transitions are set explicitly rather than left to library defaults:

- **Stack pushes**, in the auth and calendar stacks: a horizontal slide from the right.
- **Event form**: presented as a modal that slides up from the bottom.
- **Tab switches** between Calendar and Profile: a 200 ms cross-fade.
- **Month changes** in the grid: the new month slides in from the direction of travel and fades
  in over 250 ms.
- **Month/Day switch**: a 200 ms cross-fade.

Durations come from the `motion` tokens in `src/theme/motion.ts`. Reduce Motion is respected
through `AccessibilityInfo` in `src/app/useReduceMotion.ts`. The hook reads the setting at
startup and then subscribes to changes, so turning it on while the app is running takes effect
immediately. When it is on, every transition above is instant.

iOS platform limits:

- **Pushes.** The standard `slide_from_right` push resolves to the native UIKit transition, whose
  duration (about 350 ms) cannot be changed. The stacks use `simple_push` on iOS instead, which
  is the same right-to-left slide but accepts a 250 ms duration.
- **Modals.** Screens presented with `presentation: 'modal'` always use the system sheet
  animation, which has a fixed duration.
- **Android.** `animationDuration` is ignored on Android, so its transitions use platform timing.

## Accessibility

Interactive elements carry accessibility labels, roles and states throughout: each calendar day
is announced with its full date and event count, marked "today" where it applies, and reports
whether it is selected. Event blocks read out their title and time range, and switches and
buttons report their disabled state. Form errors are announced as alerts. Most touch targets are
at least 44 pt.

The component tests query what a screen-reader user would find, by accessibility label, role
and state (for example `getByLabelText`, `getByRole('button', { selected: true })`), rather than
by test IDs. The app code sets test IDs only where there is no accessible content to query: the
decorative category dots, and the grid container whose layout pass the tests trigger. The
cross-fade hook's test adds its own to the small harness it renders.

## Known limitations

- The local repositories are a mock backend, not a production auth or data layer.
- Passwords are stored unhashed in AsyncStorage, and AsyncStorage is not encrypted. The Keychain
  entry for biometric unlock also holds the password. A real implementation would not keep a
  password on the device at all: it would keep a refresh token in the Keychain, and biometric
  unlock would exchange that token for a new session.
- Events store local wall-clock time rather than a UTC instant plus an IANA timezone id. An
  event has no record of the timezone it was created in, so travel or sharing across timezones
  cannot be handled correctly.
- iOS only. The app has been built and run only on the iOS simulator; Android is untested.

## Testing

```
npm test                    # run the suite
npx jest --coverage         # with coverage
```

96 tests across 11 suites, all passing. Coverage is measured across all of `src/` (excluding
test files), not only the files a test imports: 48% of statements.

| Suite | Tests | Covers |
| --- | --- | --- |
| `dateUtils.test.ts` | 26 | Grid generation, 4/5/6-row months, leap years, year rollover, month and day navigation, local ISO round-tripping |
| `authSlice.test.ts` | 12 | Sign-in, sign-up, sign-out, biometric enrolment (a wrong password never reaches the Keychain; a cancelled prompt is not an error) |
| `eventsSlice.test.ts` | 13 | Create/update/delete, day and month selectors, profile statistics selector, error handling |
| `eventRepository.test.ts` | 4 | Persistence, including backfilling events saved before categories existed |
| `eventDefaults.test.ts` | 5 | Default start and end times for a new event, including midnight |
| `MonthGrid.test.tsx` | 13 | Cell count per month, today and selected markers, category dots, day selection, column layout |
| `DayView.test.tsx` | 6 | Sorting by start time, empty state and create action, event selection |
| `DayScheduleView.test.tsx` | 6 | All 24 hour rows, creating at an hour, overlap columns and the four-column cap |
| `useViewModeCrossFade.test.tsx` | 5 | Month/Day cross-fade: no flash, reversal mid-fade, no remounting, Reduce Motion |
| `FormField.test.tsx` | 5 | Label, error alert, value and prop pass-through |
| `App.test.tsx` | 1 | The full app tree renders |

Well covered (over 80% of statements): the date utilities, the events slice and repository,
the event defaults, the presentational calendar components, `FormField`, and the theme.

Not covered:

- **Screens:** Login, SignUp, Unlock, Calendar, EventForm and Profile, all under 12% of
  statements.
- **Storage wrappers:** the AsyncStorage auth repository and the Keychain biometric
  repository, both under 10%.
- **Navigators, `useReduceMotion`, and the stack animation options.**
- **Auth slice:** about half its statements are covered.

## Data layer

Persistence sits behind `AuthRepository` and `EventRepository`. Firebase was the initial
choice, but `@react-native-firebase/firestore` pulls in the Firebase iOS SDK, which depends on
gRPC, and gRPC compiles from source and fails to generate a module map under
`use_modular_headers!` with Xcode 26's clang. Neither `$RNFirebaseDisableSPM` nor modular
headers resolved it. Because screens
and Redux only depend on the interfaces, switching to local storage meant writing one
implementation file per repository rather than rewriting the app, and a hosted backend can
replace those files the same way.

## What I'd add next

- An agenda view listing upcoming events grouped by day.
- An app-lock layer that re-authenticates when the app returns to the foreground after a
  timeout, as banking apps do, rather than only at launch.
- Android verification.
