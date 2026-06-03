# Surface Pack: Mobile

A **first-class** member of the surfaces registry (`surfaces/_registry.md`) — same `detect` /
`guardrails` / `verification` / `modelingNotes` interface as every other pack. Fires for native iOS,
native Android, and the cross-platform stacks (React Native, Flutter, Expo, Kotlin Multiplatform,
.NET MAUI). It owns the three things that make mobile structurally different from a server you can
redeploy in seconds:

1. **The artifact is a binary you ship through a review queue** — you cannot hot-fix it. Once
   shipped, it runs on devices you do not control, possibly for years.
2. **State lives on the device** and outlives any single app version — offline storage, sync, and
   on-device schema migrations are the norm, not the exception.
3. **The OS mediates capability and data** — permissions, privacy prompts, push tokens.

This pack runs *with* `web-backend.md` whenever a mobile slice also touches a server concern (a
payments screen, an auth token, an API call): take the **union** of fired surfaces and resolve any
guardrail conflict to the **stricter / more one-way** rule (registry precedence). This pack adds the
device-side guardrails web-backend does not own; it never restates web-backend's money/auth/migration
rules — it references them.

---

## detect

Run over the slice plan + intended footprint + changed files. Any hit flags the listed surface(s).
Map each fired surface onto the **domain-surface names** in `disciplines/risk-tiering.md` §2 so the
tier gate stays modality-neutral.

| Signal (file globs / imports / path conventions / keywords) | Flags surface |
| --- | --- |
| **Project markers** — `ios/`, `*.xcodeproj`, `*.xcworkspace`, `Info.plist`, `*.pbxproj`; `android/`, `build.gradle(.kts)`, `AndroidManifest.xml`, `gradlew`; `pubspec.yaml` + `lib/` (Flutter); `react-native`/`expo` in `package.json`, `metro.config.*`, `app.json`/`app.config.*`; `*.xcconfig` | `mobile` (pack active) |
| **Cross-platform runtime** — imports of `react-native`, `expo*`, `flutter`/`dart:*`, `@capacitor/*`, Kotlin `commonMain`, MAUI `Microsoft.Maui` | `mobile` |
| **Store / release config** — `fastlane/`, `Fastfile`, `*.mobileprovision`, signing configs, `versionCode`/`versionName`, `CFBundleShortVersionString`/`CFBundleVersion`, `eas.json`, Play `track:`, App Store Connect config, entitlements files | `mobile`, `ship-irreversibility` |
| **Compiled-in feature flag / config** — a flag or config constant baked into the binary at build time (build-flavor/scheme, `BuildConfig`, `#if DEBUG`, `Constants.expoConfig`, a hardcoded `enableX = true`) **with no remote override** | `ship-irreversibility` (a flag you cannot flip post-ship is a shipped decision) |
| **Remote flag / config** — LaunchDarkly, Firebase Remote Config, ConfigCat, a fetched config blob gating behavior | `mobile` (this is the *mitigation* for ship-irreversibility — note it, do not penalize it) |
| **On-device storage** — SQLite/`Core Data`/`Room`/Realm/WatermelonDB/Drift, `UserDefaults`/`SharedPreferences`/`AsyncStorage`/MMKV, file-backed caches, a bundled migrations folder | `persistence / migration`, `on-device-data` |
| **Offline-first sync** — a local store that is the source of truth while offline + a server it reconciles with: replication libs (WatermelonDB sync, Realm Sync, PowerSync, ElectricSQL, Couchbase Lite), a hand-rolled outbox/mutation queue, `lastSyncedAt`/`pending`/`dirty`/`tombstone` columns, conflict/merge logic | `offline-sync`, `external-effect / idempotency`, `persistence / migration` |
| **Push** — APNs/FCM, `UNUserNotificationCenter`, `firebase-messaging`, device-token registration, notification handlers | `external-effect / idempotency`, `mobile` |
| **Secure / regulated on-device data** — Keychain/Keystore, `EncryptedSharedPreferences`, biometric gating, stored tokens/credentials, health/location/contacts data at rest | `security`, `PII`, `on-device-data` |
| **Permissions / privacy** — a permission request API, `Info.plist` `NS*UsageDescription` keys, Android `<uses-permission>` / runtime `requestPermissions`, `PrivacyInfo.xcprivacy`, ATT (App Tracking Transparency) | `permissions-privacy`, `PII` (when the permission gates personal data) |

**Pack-owned surface names** (in addition to the shared domain surfaces above):
`ship-irreversibility`, `offline-sync`, `on-device-data`, `permissions-privacy`. The shared names
(`persistence / migration`, `external-effect / idempotency`, `security`, `PII`) gate the risk tier
exactly as in `risk-tiering.md`; the pack-owned names attach the device-specific guardrails below.

---

## guardrails

`[{ surface, when, check, oneWayDoor }]` — attached **only** when `when` fires. Each `check` is a
named PASS criterion a verifier (S3 plan / S5 build) can assert. Money / auth on a mobile screen
defer to `web-backend.md`'s guardrails (stricter wins) — not restated here.

### G1 — `ship-irreversibility` · a shipped binary cannot be hot-fixed · **oneWayDoor: true**

- **when** — the slice changes behavior that will run inside a released binary AND the change is
  risky (any domain surface fired, OR a data/schema/protocol shape, OR an irreversible user-visible
  effect) AND there is no instant server-side off-switch.
- **check `G1_flag_gated_default_off`** — the risky change is gated behind a **remote** flag/config
  whose **default is OFF**, fetched at runtime, so it can be disabled on devices **without** shipping
  a new binary. A compile-time-only flag does **not** satisfy this (you cannot flip it post-ship).
  The first real-world enablement is a deliberate, monitored rollout, not the ship event.
- **check `G1_irreversible_is_one_way`** — any once-shipped-irreversible effect (a data
  transformation applied on first launch, a destructive local migration, an external call fired on
  upgrade, a permission consumed, a credential rotated) is treated as a **one-way door**: routed
  through `disciplines/obstruction-loop.md` Tier 3 (ADR + `ARCH-DEBT` + reversible interim), never
  shipped on a guess. App-store **review latency** (days) IS the irreversibility — a bug discovered
  post-submit cannot be pulled back in time.
- **Rationale the verifier checks against:** "we can patch it later" is false on mobile. The safe
  shape is *ship the code dark behind a default-off remote flag, then enable remotely*.

### G2 — `offline-sync` · offline→online reconciliation can lose data · **oneWayDoor: true**

Offline-first sync is treated as a **one-way door by rule** (it is `persistence / migration` +
`external-effect / idempotency` — both one-way per `obstruction-loop.md` §3). Data silently lost in a
merge is unrecoverable. All four must hold:

- **check `G2_conflict_resolution`** — there is an **explicit, deterministic** conflict-resolution
  policy for the synced shape (last-write-wins **with a defensible clock**, CRDT, server-authoritative,
  or field-level merge) — *named in the plan*, not implicit "whatever writes last." LWW on a
  device wall-clock is called out as a hazard (clock skew → silent loss) unless justified.
- **check `G2_durable_queue`** — local mutations made offline are persisted to a **durable** outbox
  queue (survives app kill / crash / reboot), not held only in memory.
- **check `G2_idempotent_replay`** — every queued mutation carries a **stable client-generated id**
  (not a server autoincrement) so replay after a flaky/duplicate send is **idempotent** — applying it
  twice equals applying it once. This is `web-backend.md`'s idempotency-key guardrail applied at the
  device boundary; reference it, do not re-derive it.
- **check `G2_partial_sync_safe`** — a sync interrupted mid-flight (network drop, app backgrounded,
  process death) leaves the local store in a consistent state and resumes/retries without
  double-applying or dropping the tail of the queue.
- **Modeling default:** when offline writes can conflict and the change cannot be proven loss-free,
  **treat it as one-way** and escalate via the obstruction loop rather than shipping the merge.

### G3 — `on-device-data` · schema evolution must be forward/back compatible · **oneWayDoor: true**

The device holds the only copy of some state, across app versions the user upgrades on their own
schedule (and may **downgrade**, or skip versions). This is `persistence / migration` — defer the
generic expand/contract migration discipline to `web-backend.md`; this guardrail adds the
device-specific compatibility constraints:

- **check `G3_versioned_forward_migration`** — the on-device schema is **versioned**, and there is a
  forward migration for every prior shipped version a user could be upgrading **from** (not just the
  immediately previous one — version skipping is normal). The migration is tested on a store seeded at
  the old shape, asserting the post-migration shape + no data loss.
- **check `G3_back_compat_or_guarded`** — adding a field is **additive** (old binaries ignore unknown
  fields; new binaries default missing fields) — this is the **`field-not-new-store`** modeling rule
  (see modelingNotes). A non-additive change (rename/drop/retype, splitting a store) is a one-way
  door: either keep it back-compatible, or escalate it via the obstruction loop with an explicit
  no-downgrade decision recorded.
- **check `G3_migration_failure_safe`** — migration runs at a defined point (first launch on the new
  version) and **fails safe**: a failed/partial migration does not corrupt or wipe the store, leaves a
  recoverable state, and is observable (not a silent catch).

### G4 — `permissions-privacy` · OS-mediated capability + privacy prompts

- **check `G4_permission_requested_with_rationale`** — every capability the slice uses is **declared**
  (`Info.plist` usage-description key / `AndroidManifest` `<uses-permission>`) **and requested at the
  right time** with user-facing rationale; the code path **degrades gracefully when the permission is
  denied or revoked** (denied is the common case, not the exception — no crash, no dead-end).
- **check `G4_privacy_declared`** — data collection triggered by the permission is reflected where the
  platform requires it (`PrivacyInfo.xcprivacy` / Play Data-safety / ATT prompt for tracking). PII at
  rest defers to `web-backend.md` security/PII guardrails (encrypted store, Keychain/Keystore).
- A permission, once granted-and-acted-on (data collected, token obtained), is an **external effect** —
  re-prompting or scope changes are one-way for the data already gathered.

### G5 — `push` · device-token + notification delivery · **oneWayDoor: true (delivery side)**

- **check `G5_token_lifecycle`** — device-token registration handles **token rotation/invalidation**
  (tokens change; a stale token is dropped server-side) and registration failure does not block the
  app.
- **check `G5_idempotent_delivery`** — notification **handling** is idempotent: the same push
  delivered twice (APNs/FCM are at-least-once) does not double-apply a side effect. This is the
  `external-effect / idempotency` guardrail from `web-backend.md` at the device receive boundary.

**Conflict resolution across packs:** where this pack and `web-backend.md` both fire (e.g. a sync that
writes money, or a push that triggers a payment), the **more one-way** guardrail wins and the
**deeper** check applies. Money is always integer-minor-units + web-backend's rules, on **both** sides
of the sync boundary.

---

## verification

Defines what **"real entry point with real data"** (`disciplines/honest-verification.md` R2) means on
mobile, and which rungs are mandatory for which fired surface. R0/R1 (build, focused non-tautological
tests) and the tier floors are unchanged from `risk-tiering.md`; this pack specifies R2–R4.

**R2 — real entry point, real data (the spine):** run the app on a **simulator/emulator** (or a real
device), drive the slice's behavior through the **actual UI**, and **capture + inspect a screenshot**
(the UI-screenshot checklist in `honest-verification.md` applies — element rendered, spec data
visible, no error/broken layout, one negative interaction handled). A unit/widget test alone is **not**
R2 for a mobile UI slice. If the slice has no UI (a background sync, a migration), R2 is exercising it
through its real trigger (launch / network-state change / received push) on the emulator and asserting
the on-device result (the store row, the file, the queue state) — not a mocked harness.

**Mandatory rungs by fired surface** (climb to the highest that applies; never below the tier floor):

| Fired surface | Mandatory rung | What R2/R3 must concretely exercise on device/emulator |
| --- | --- | --- |
| `offline-sync` | **R3** | **Exercise offline→online:** put the app **offline** (airplane mode / network condition), perform the mutation, confirm it queued durably; go **online**, confirm it synced **exactly once**; then **R3 negative:** force a **conflict** (edit the same record on the server side / a second client) and assert the named resolution policy produced the spec-stated winner with **no lost write**; kill the app mid-sync and confirm clean resume. |
| `on-device-data` | **R3** | Seed the store at a **prior shipped schema version** (and a skipped version), launch the new binary, assert the migration ran and **no data was lost**; assert a **failed** migration leaves a recoverable store (not wiped). |
| `ship-irreversibility` | **R2 + flag proof** | Prove the risky path is **OFF by default** with the remote flag in its default state, and that flipping the flag (remote/mock) turns it on at runtime **without a rebuild**. Shipping-on means the dark path was verified behind the flag first. |
| `permissions-privacy` | **R3** | Exercise the **grant** path AND the **deny/revoke** path through the real prompt on the emulator; assert graceful degradation on deny. |
| `push` | **R3** | Send a test push to the emulator/device; assert handled once; send a **duplicate** and assert the side effect did **not** double-apply. |

- **Cross-platform packs:** a slice shipping to both iOS and Android is **not** R2-verified until run
  on **both** an iOS simulator and an Android emulator (platform-divergent behavior — permissions,
  storage paths, push, lifecycle — is exactly where mobile silently breaks). State per-platform
  results.
- **`code-verified` honesty (`honest-verification.md`):** if no simulator/emulator is available in the
  environment, R2 is **blocked** — report `verdict:BLOCKED`, `failedCriterion:"R2_real_entry blocked:
  no emulator"`, list the residual risk (the device behavior NOT exercised), and let the engine
  degrade. Never report a CRITICAL mobile slice as `verified` off green unit tests alone.
- **R4 (integration):** at S6/S7, exercise a full offline→online round-trip across the slices that
  share the synced store / the queue / the migration, on at least one real platform.

---

## modelingNotes

Refines `disciplines/adjective-noun.md` for the mobile persistent type (the local struct/record +
its sync payload). The one-line three-part argument and the two smells are unchanged; these are the
modality reads:

- **`field-not-new-store`** — an adjective on an on-device entity is a **field/enum/flag on the
  existing local record + its sync payload**, never a new store/table/entity per state. `draft note`
  → `note.status`, not a `DraftNotes` store. A flag compiled into the binary is **still a field**, not
  a new type. (This is `field-not-table` read for the device.)
- **Schema evolution is additive-first** — model new state as an **additive field** with a sensible
  default so old binaries (which ignore it) and new binaries (which default it) stay compatible (G3).
  Splitting a store, renaming, or retyping is the over-split / one-way-migration smell — argue for it
  with the three-part test AND a no-downgrade decision, or collapse it to an additive field.
- **Sync identity** — the synced record's identity is a **stable client-generated id** (so offline
  creates have an id before the server sees them, enabling idempotent replay — G2). A server
  autoincrement as primary identity is an offline-sync hazard; flag it.
- **Tombstones, not hard deletes** — offline-deletable records carry a soft-delete/tombstone field so
  the deletion can sync (a row that just vanishes locally cannot be reconciled). Soft-delete is a
  **field on the noun** (`deletedAt`), per the lens — not a separate store.

---

## Gate (this pack's contribution to a step's verdict)

For a slice whose `detect` activated this pack, the pack is **satisfied** iff: every **fired**
guardrail's named `check` is PASS (G1–G5 as applicable), the verification table's **mandatory rung for
each fired surface** was actually reached on a simulator/emulator (or honestly reported `BLOCKED`), and
the modeling notes' `field-not-new-store` rule holds for any new on-device shape. Any failure → the
owning step names the failed `check` (e.g. `G2_idempotent_replay`, `G1_flag_gated_default_off`) in its
`failedCriterion`; one-way guardrails that cannot be satisfied route through
`disciplines/obstruction-loop.md` Tier 3, never ship on a guess.
