# Firebase Migration Plan

## Goal

Replace the WebRTC/PeerJS transport with Firebase-backed event streams while keeping the existing client-side reducer model as intact as possible.

This is not a mutable Firestore-state design. The only mutable server documents should be user records. Lobby state and game state are derived by replaying append-only events. Clients may cache hydrated state locally, but Firebase should store the event history, not canonical mutable lobby/game snapshots.

Do not preserve legacy WebRTC, PeerJS, peer IDs, peer-host relaying, or lobby leader election. The replacement should preserve the existing action shape wherever possible and move the transport from peer messages to Firebase event logs.

## Installed Tooling

Firebase dependencies are installed through `package.json`:

- `firebase` is the client SDK for Auth, Firestore, and emulator connections.
- `firebase-tools` is the local CLI for login, emulator execution, project initialization, rules deployment, and hosting deployment.

The local CLI is currently authorized as `alex@boardgamescafe.org` according to `bun firebase login:list`.

`flake.nix` does not need Firebase additions because Bun can provide the Firebase CLI and client SDK.

## Core Architecture

Firebase replaces WebRTC as the broadcast medium. Every client subscribes to ordered event collections, replays events through reducers, and derives current state locally.

The model is:

- Mutable documents: `/users/{uid}` only.
- Append-only lobby events: `/lobby/{eventId}`.
- Append-only game events: `/games/{gameId}/actions/{eventId}`.
- Local hydrated cache: IndexedDB or localStorage, keyed by reducer version and event cursor.

There should be no mutable `/games/{gameId}` state document, no mutable `/publicGames/{gameId}` listing, and no mutable lobby state document. Current lobby and game state are projections derived from event logs.

## Authentication

Every visitor signs in anonymously before using the lobby or joining a game. This gives each browser a stable Firebase Auth UID for event attribution, user profile ownership, and security rules.

Google sign-in is optional. A user may link a Google account, but anonymous play remains the default.

### Anonymous Flow

1. Initialize Firebase.
2. Observe auth state.
3. If no current user exists, call `signInAnonymously`.
4. Create or update `/users/{uid}` with display name/avatar defaults.
5. Subscribe to `/lobby` and replay lobby events.

Anonymous identity persists in the browser through Firebase Auth persistence, so reloads normally keep the same UID.

### Optional Google Link Flow

1. User clicks "Sign in with Google".
2. If current user is anonymous, call `linkWithPopup(currentUser, googleProvider)`.
3. On success, the UID remains the same and all previous events remain valid.
4. Update `/users/{uid}` with `googleLinked: true` and any chosen profile fields.
5. If the Google credential already belongs to another Firebase user, sign in with Google and treat that as an account switch rather than rewriting old events.

Historical event authorship should not be rewritten. Events are immutable.

## Mutable Collection

### `/users/{uid}`

This is the only mutable Firestore document type.

Fields:

- `uid`
- `displayName`
- `avatar`
- `visibility`: `visible | lurking`
- `presence`: `online | idle | offline`
- `activeGameId`
- `isAnonymous`
- `googleLinked`
- `googleEmail`
- `createdAt`
- `updatedAt`
- `lastSeenAt`

Allowed writes:

- Owner creates their user record after auth.
- Owner updates name/avatar.
- Owner updates visibility.
- Owner updates presence and `lastSeenAt`.
- Owner updates Google link metadata after optional linking.

Read model:

- Signed-in users may read user records needed to hydrate lobby/game display.
- Clients join event actor UIDs to `/users/{uid}` records for current names, avatars, visibility, and presence.

Rationale:

- Names, avatars, Google links, visibility, and presence are identity/presence concerns, not historical game facts.
- Keeping them mutable avoids rewriting old events when a player changes their name or avatar.

## Event Envelope

Every lobby and game event should use a shared envelope.

```ts
interface FirebaseEvent<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload: TPayload;
  actorUid: string;
  createdAt: Timestamp;
  schemaVersion: number;
  reducerVersion: number;
}
```

Fields:

- `type`: existing Redux action type where practical.
- `payload`: existing Redux action payload where practical.
- `actorUid`: Firebase Auth UID of the writer.
- `createdAt`: Firestore server timestamp.
- `schemaVersion`: event envelope version.
- `reducerVersion`: reducer semantics version used by the client that wrote the event.

Clients query by `createdAt` and locally use the Firestore document ID as a final tie-break if two events have the same server timestamp. Event document IDs are generated with a sortable local append prefix so sequential writes from one client replay in write order even when Firestore assigns identical server timestamps. During pending local writes where `createdAt` is unresolved, durable cache cursors should only advance through events with server timestamps.

## Local Hydrated Cache

Each client may cache derived lobby/game state locally to avoid replaying the full event stream on every load.

Suggested cache key:

- stream scope: `lobby` or `game:{gameId}`
- reducer version
- last applied event cursor: `{ createdAt, documentId }`
- hydrated state

Replay rules:

1. If no cache exists, replay from the beginning.
2. If cache reducer version differs from the current reducer version, discard the cache and replay from the beginning.
3. If cache exists and reducer version matches, hydrate from cache.
4. Query events after the cached cursor.
5. Replay only those later events.
6. Persist updated hydrated state and cursor.

Reducer version must be incremented whenever replay semantics change. Event schema version only changes when the stored event shape changes.

## Lobby Event Stream

### Collection: `/lobby/{eventId}`

Append-only global lobby log. Every client subscribes to this collection and replays all relevant events to derive lobby state.

There is no mutable lobby state document.

Ordering:

- Primary: `createdAt`
- Tie-break: document ID if server timestamps are identical

Retention:

- Keep the event log long enough that old clients can recover.
- If the log grows too large, introduce snapshot events, not mutable snapshot documents.

### Lobby Projection

The current lobby state is derived locally as:

- active players: latest relevant user records plus recent lobby/presence events
- public games: games created but not started/closed/abandoned
- hidden games: not shown publicly, but joinable by ID/invite event
- player counts: derived from create/join/leave/start events

User visibility and presence should come from `/users/{uid}`. Lobby events should describe lobby/game facts, not mutable identity status.

### Lobby Events

Use existing action design where practical. Existing lobby reducer actions are not currently in the network sync list, so these event names intentionally mirror the existing lobby slice concepts.

#### `lobby/join`

Payload:

```ts
{
  uid: string
}
```

Effect:

- Marks the actor as present in the lobby projection.
- Display name/avatar/visibility are read from `/users/{uid}`.

Justification for action shape:

- Existing implementation passed full profiles through lobby messages. In the Firebase design, mutable profile fields live only in `/users`, so lobby events only need UID.

#### `lobby/leave`

Payload:

```ts
{
  uid: string
}
```

Effect:

- Marks the actor as explicitly absent from the lobby projection.

#### `lobby/createGame`

Payload:

```ts
{
  gameId: string;
  name: string;
  visibility: 'public' | 'hidden';
  maxPlayers: number;
}
```

Effect:

- Adds an open game to the lobby projection.
- If `visibility` is `public`, all clients show it.
- If `hidden`, clients only join through direct game ID/invite flow.

Existing action comparison:

- Replaces `registerGame(GameInfo)` as an event.
- Required change: `gameId` must be explicit because there is no host peer ID to use as the game address.

#### `lobby/updateGame`

Payload:

```ts
{
  gameId: string;
  name?: string;
  visibility?: 'public' | 'hidden';
  maxPlayers?: number;
}
```

Effect:

- Updates derived lobby projection for an open game.

Existing action comparison:

- Similar to repeated `registerGame(GameInfo)` messages in the current lobby.
- Kept separate so game creation remains an immutable fact.

#### `lobby/joinGame`

Payload:

```ts
{
  gameId: string;
  uid: string;
}
```

Effect:

- Adds the player to the game roster projection while the game is open.
- Updates public player count by replay.

#### `lobby/leaveGame`

Payload:

```ts
{
  gameId: string;
  uid: string;
}
```

Effect:

- Removes or marks player absent in the game roster projection before start.

#### `lobby/startGame`

Payload:

```ts
{
  gameId: string;
}
```

Effect:

- Removes the game from public open-game listings.
- Marks the lobby projection for that game as playing.

The actual `game/start` action is stored in `/games/{gameId}/actions`.

#### `lobby/closeGame`

Payload:

```ts
{
  gameId: string;
  reason: 'hostClosed' | 'abandoned' | 'finished';
}
```

Effect:

- Removes the game from open lobby projections.

Existing action comparison:

- Replaces `unregisterGame(hostId)`.
- Required change: uses `gameId` instead of `hostId` because games are no longer hosted at peer IDs.

## Game Event Streams

### Collection: `/games/{gameId}/actions/{eventId}`

Append-only game action log. Every member of a game subscribes to this collection and replays events through the game/player reducers to derive current game state.

There should be no mutable game state document. The path `/games/{gameId}` may exist only as an ancestor for the subcollection; it should not contain mutable canonical state.

Ordering:

- Primary: `createdAt`
- Tie-break: document ID if server timestamps are identical

Membership:

- Membership is derived from `/lobby` events.
- A client can read a game action stream if replaying `/lobby` shows that its UID joined that game and was not removed before start, subject to security rule practicality.

Security note:

- Any signed-in user may read any game action stream.
- Hidden game IDs are still useful for UX, but not treated as a hard security boundary.
- Firestore rules should focus on requiring auth, append-only writes, and basic actor attribution. They do not need to enforce membership or gameplay legality.

## Existing Game Actions

The following existing Redux action types should be preserved as game events unless implementation work proves a specific breakage.

### `players/addPlayer`

Existing payload:

```ts
{
  id: string;
  name: string;
}
```

Firebase payload:

```ts
{
  id: string;
  name: string;
  uid?: string;
}
```

Reducer effect:

- Same as current `players/addPlayer`.

Required change:

- Prefer `id === uid` for new Firebase games.
- `uid` may be included during migration clarity, but the reducer can continue using `id`.
- Name is technically mutable in `/users`; keeping `name` preserves the current reducer and gives historical display stability. UI can later prefer `/users/{uid}.displayName`.

### `players/setHand`

Existing payload:

```ts
{
  id: string;
  hand: number[];
}
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `players/setHand`.

Security/visibility:

- This preserves the existing action design, where all clients can hydrate all hands and UI masking prevents a player from viewing their own numbers.
- This is less private than a server-private hand model, but changing it would require a larger action redesign. The user explicitly requested avoiding action changes unless required, so this plan keeps `players/setHand`.

### `game/start`

Existing payload:

```ts
{
  deck: number[];
  turnOrder: string[];
  initialPublic: number[];
  seed: number;
}
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `game/start`.

Authoring:

- The game creator/host client can generate the shuffled deck as today and write `players/setHand` events plus `game/start`.
- A future hardening pass could move shuffle/deal to a Cloud Function, but that would change the trust model more than this migration requires.

### `game/reveal`

Existing payload:

```ts
TileColor
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `game/reveal`.

### `players/clue_sort`

Existing payload:

```ts
{
  targetId: string;
  tileId: number;
}
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `players/clue_sort`.

### `players/clue_compare`

Existing payload:

```ts
{
  targetId: string;
  tileId: number;
  targetSlot: number;
}
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `players/clue_compare`.

### `game/nextTurn`

Existing payload:

```ts
undefined
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `game/nextTurn`.

### `players/guess`

Existing payload:

```ts
{
  playerId: string;
  guessedHand: number[];
}
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `players/guess`.

### `players/eliminatePlayer`

Existing payload:

```ts
string
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `players/eliminatePlayer`.

### `game/setWinner`

Existing payload:

```ts
string
```

Firebase payload:

- Same.

Reducer effect:

- Same as current `game/setWinner`.

## Event Write Flows

### Create Public Game

1. User is anonymously or Google authenticated.
2. Client creates a 5-letter uppercase game code and checks `/lobby` for an existing `lobby/createGame` event with the same code.
3. If the code already exists, client generates another code and retries.
4. Client writes `/lobby/{eventId}` with `type: lobby/createGame`.
5. Client writes `/lobby/{eventId}` with `type: lobby/joinGame`.
6. All clients replay `/lobby` and show the new public game.

### Create Hidden Game

1. Same as public game, but `visibility: hidden`.
2. Hidden games are not displayed in the public game list projection.
3. Invite link contains `gameId`.
4. Joiners write `lobby/joinGame` for that `gameId`.

### Join Game

1. Client writes `lobby/joinGame`.
2. Client subscribes to `/games/{gameId}/actions`.
3. Client hydrates game state from cache or replay.
4. If game has not started, local lobby projection includes the player in the roster.

### Observe Game URL

1. Visitor opens a URL containing `gameId`.
2. Client signs in anonymously if needed.
3. Client subscribes to `/games/{gameId}/actions` without writing `lobby/joinGame`.
4. If the game has started, replayed actions render the current game state.
5. If the game has not started and the visitor wants to play, the normal profile and join flow remains available.

### Start Game

1. Host derives roster from replayed `/lobby` events.
2. Host writes game events to `/games/{gameId}/actions`:
   - one `players/addPlayer` per roster member
   - one `players/setHand` per roster member
   - one `game/start`
3. Host writes `lobby/startGame` to `/lobby`.
4. Clients replay game actions to enter playing state.

Ordering note:

- The host writes game setup actions sequentially and awaits each append.
- Clients order by `createdAt`, with document ID as a local tie-break for identical timestamps.
- Justification: existing WebRTC sent actions in order over a connection. Sequential Firestore appends use sortable event document IDs to preserve that model without adding custom client-side ordering fields.

### Reveal and Ask Clue

Current UI dispatches `game/reveal`, then later `players/clue_sort` or `players/clue_compare`, then `game/nextTurn`.

Firebase flow:

1. Current player writes `game/reveal` when they reveal a tile.
2. Current player writes `players/clue_sort` or `players/clue_compare`.
3. Current player writes `game/nextTurn`.
4. All clients replay the same actions.

This preserves the existing action design.

### Guess

Current UI dispatches `players/guess`, then conditionally `players/eliminatePlayer`, `game/nextTurn`, and/or `game/setWinner`.

Firebase flow:

1. Guessing player writes `players/guess`.
2. The same client writes the follow-up events currently produced by UI logic:
   - `players/eliminatePlayer` if incorrect
   - `game/nextTurn` if incorrect and turn should advance
   - `game/setWinner` if correct or one active player remains
3. All clients replay the same events.

This preserves the existing action design.

Risk:

- As in the current implementation, the client remains trusted to write correct follow-up events.
- A future hardening pass could replace this with a Cloud Function that appends the derived follow-up events, but that is not required for the Firebase transport rewrite.

### Leave or Close Game

Before game start:

1. Player writes `lobby/leaveGame`.
2. Lobby projection removes them from the open-game roster.

Host closes game:

1. Host writes `lobby/closeGame`.
2. Lobby projection removes the game.

During game:

1. Presence changes in `/users/{uid}` indicate online/offline state.
2. The game action stream should not automatically mutate because of transient disconnect.
3. If the UI needs an explicit forfeit, add a game action only when the player chooses to forfeit.

## Client Replay Flows

### App Boot

1. Authenticate anonymously if needed.
2. Load `/users/{uid}` or create it.
3. Subscribe to user records needed for display.
4. Hydrate lobby projection from local cache if reducer version matches.
5. Query `/lobby` after cached cursor.
6. Replay new lobby events.
7. Persist updated lobby projection and cursor.

### Lobby Screen

1. Keep `/lobby` subscription live.
2. Keep `/users` reads live for visible UIDs in the projection.
3. Derive public games locally.
4. Derive player counts locally.
5. Derive whether the current user is in a game locally.

### Game Screen

1. Determine membership from lobby projection.
2. Hydrate game projection from local cache if reducer version matches.
3. Query `/games/{gameId}/actions` after cached cursor.
4. Replay new game actions through existing reducers.
5. Persist updated game projection and cursor.
6. Subscribe live for subsequent game actions.

### Reducer Version Changes

If reducer semantics change:

1. Increment reducer version constant.
2. Cached projections with older reducer versions are ignored.
3. Client replays the relevant stream from the beginning.
4. New cache is written with the new reducer version.

## Firestore Rules Direction

Rules should enforce only the simple invariants needed by this event-sourced transport.

Required:

- All writes require auth.
- Any signed-in user can read `/lobby` and any `/games/{gameId}/actions` stream.
- `/users/{uid}` can only be written by `uid`.
- `/lobby/{eventId}` can only be created, never updated or deleted.
- `/games/{gameId}/actions/{eventId}` can only be created, never updated or deleted.
- Event `actorUid` must equal `request.auth.uid`.
- Event `createdAt` must be a server timestamp.
- Event type and payload validation may stay client-side for the first rewrite.

Not required in rules for the first rewrite:

- Full turn validation.
- Full membership replay.
- Write authorization by game membership.
- Guess correctness validation.
- Clue correctness validation.
- Deck integrity validation.

Those constraints were not truly enforced by the existing client/WebRTC model either. The migration goal is reliability of broadcast/replay, not a complete anti-cheat backend.

## Snapshot Events

If event streams become large, use append-only snapshot events rather than mutable snapshot documents.

Lobby snapshot event:

- `type: lobby/snapshot`
- payload contains the derived lobby projection and the cursor it summarizes.

Game snapshot event:

- `type: game/snapshot`
- payload contains the derived game projection and the cursor it summarizes.

Clients may start from the newest trusted snapshot event whose reducer version matches, then replay later events.

Snapshot events are optional and should not be part of the first implementation unless replay cost becomes visible.

## Testing Plan

Use Firebase Emulator Suite.

E2E tests should cover:

- anonymous sign-in
- optional Google-link UI path, mocked/skipped where emulator support is awkward
- user profile mutation
- lobby event replay from empty cache
- lobby event replay from cached cursor
- cache invalidation after reducer version bump
- public game create/join/leave
- hidden game create/join by link
- game setup event replay
- reveal event replay
- sort clue event replay
- compare clue event replay
- guess event replay
- winner event replay
- reconnect and catch up from cursor
- immutability rules reject event update/delete

## Migration Steps

1. Add Firebase project and emulator config.
2. Add Firebase initialization/auth module.
3. Add `/users/{uid}` profile and presence handling.
4. Add append-only event writer helper with common envelope.
5. Add event-stream reader with ordered replay and cursor support.
6. Add local projection cache keyed by stream and reducer version.
7. Replace lobby WebRTC manager with `/lobby` event replay.
8. Replace game network middleware with `/games/{gameId}/actions` event writes and replay.
9. Keep existing Redux action types for game actions.
10. Remove PeerJS/WebRTC dependencies and network modules.
11. Rewrite E2E tests around Firebase emulators.

## Explicit Non-Goals

- Preserve WebRTC compatibility.
- Preserve PeerJS IDs.
- Preserve peer-host relaying.
- Preserve lobby leader election.
- Introduce mutable lobby/game state documents.
- Introduce a full authoritative anti-cheat backend in the first rewrite.
- Redesign existing game action payloads unless a specific Firebase ordering or identity requirement forces it.
