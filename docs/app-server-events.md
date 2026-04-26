# App-Server Events Reference (Codex `87bc72408c5ef08f8d21f2cdd00c55451c3be33f`)

This document helps agents quickly answer:
- Which app-server events AgentMonitor supports right now.
- Which app-server requests AgentMonitor sends right now.
- Where to look in AgentMonitor to add support.
- Where to look in `.ref/codex` to compare event lists and find emitters.

When updating this document:
1. Update the Codex hash in the title using the exact upstream build or tag under test.
2. AgentMonitor initializes app-server with `experimentalApi: true`, so prefer `codex app-server generate-ts --experimental` / `codex app-server generate-json-schema --experimental` as the first schema baseline, then fall back to the vendored `.ref/codex/codex-rs/app-server-protocol/schema/*` fixtures or source.
3. Compare Codex events vs AgentMonitor routing.
4. Compare Codex client request methods vs AgentMonitor outgoing request methods.
5. Compare Codex server request methods vs AgentMonitor inbound request handling.
6. Use a live `codex app-server` trace to verify lifecycle ordering when behavior depends on event timing rather than field shape.
7. Update supported and missing lists below.

Related project skill:
- `.codex/skills/app-server-events-sync/SKILL.md`

## Where To Look In AgentMonitor

Primary app-server event source of truth (methods + typed parsing helpers):
- `src/utils/appServerEvents.ts`

Primary event router:
- `src/features/app/hooks/useAppServerEvents.ts`

Event handler composition:
- `src/features/threads/hooks/useThreadEventHandlers.ts`

Thread/turn/item handlers:
- `src/features/threads/hooks/useThreadTurnEvents.ts`
- `src/features/threads/hooks/useThreadItemEvents.ts`
- `src/features/threads/hooks/useThreadApprovalEvents.ts`
- `src/features/threads/hooks/useThreadUserInputEvents.ts`
- `src/features/skills/hooks/useSkills.ts`

State updates:
- `src/features/threads/hooks/useThreadsReducer.ts`

Item normalization / display shaping:
- `src/utils/threadItems.ts`

UI rendering of items:
- `src/features/messages/components/Messages.tsx`

Primary outgoing request layer:
- `src/services/tauri.ts`
- `src-tauri/src/shared/codex_core.rs`
- `src-tauri/src/codex/mod.rs`
- `src-tauri/src/bin/codex_monitor_daemon.rs`

## Supported Notifications (Codex v2)

These are the current Codex v2 `ServerNotification` methods that AgentMonitor
supports in `src/utils/appServerEvents.ts` (`SUPPORTED_APP_SERVER_METHODS`) and
then either routes in `useAppServerEvents.ts` or handles in feature-specific
subscriptions.

- `account/login/completed`
- `account/rateLimits/updated`
- `account/updated`
- `app/list/updated`
- `error`
- `hook/completed`
- `hook/started`
- `item/agentMessage/delta`
- `item/commandExecution/outputDelta`
- `item/commandExecution/terminalInteraction`
- `item/completed`
- `item/fileChange/outputDelta`
- `item/fileChange/patchUpdated`
- `item/plan/delta`
- `item/reasoning/summaryPartAdded`
- `item/reasoning/summaryTextDelta`
- `item/reasoning/textDelta`
- `item/started`
- `thread/archived`
- `thread/closed`
- `thread/goal/cleared`
- `thread/goal/updated`
- `thread/name/updated`
- `thread/started`
- `thread/status/changed`
- `thread/tokenUsage/updated`
- `thread/unarchived`
- `turn/completed`
- `turn/diff/updated`
- `turn/plan/updated`
- `turn/started`

## Additional Stream Methods Handled In AgentMonitor

These arrive on the same frontend event stream but are not Codex v2
`ServerNotification` methods:

- approval requests ending in `requestApproval`, including
  `item/commandExecution/requestApproval`,
  `item/fileChange/requestApproval`, and
  `item/permissions/requestApproval`, via suffix match in
  `isApprovalRequestMethod(method)`
- `item/tool/requestUserInput` (a Codex v2 server request, not a notification)
- `codex/backgroundThread` (AgentMonitor synthetic bridge event)
- `codex/connected` (AgentMonitor synthetic bridge event)
- `codex/event/skills_update_available` (handled via
  `isSkillsUpdateAvailableEvent(...)` in `useSkills.ts`)

## Conversation Compaction Signals (Codex v2)

Codex currently exposes two compaction signals:

- Preferred: `item/started` + `item/completed` with `item.type = "contextCompaction"` (`ThreadItem::ContextCompaction`).
- Deprecated: `thread/compacted` (`ContextCompactedNotification`).

AgentMonitor status:

- It routes `item/started` and `item/completed`, so the preferred signal reaches the frontend event layer.
- It renders/stores `contextCompaction` items via the normal item lifecycle.
- It no longer routes deprecated `thread/compacted`.

## Missing Events (Codex v2 Notifications)

Compared against Codex app-server protocol v2 notifications, the following
events are currently not routed:

- `configWarning`
- `command/exec/outputDelta`
- `deprecationNotice`
- `externalAgentConfig/import/completed`
- `fs/changed`
- `fuzzyFileSearch/sessionCompleted`
- `fuzzyFileSearch/sessionUpdated`
- `guardianWarning`
- `item/autoApprovalReview/completed`
- `item/autoApprovalReview/started`
- `item/mcpToolCall/progress`
- `mcpServer/oauthLogin/completed`
- `mcpServer/startupStatus/updated`
- `model/rerouted`
- `model/verification`
- `rawResponseItem/completed`
- `serverRequest/resolved`
- `skills/changed`
- `thread/compacted` (deprecated; intentionally not routed)
- `thread/realtime/closed`
- `thread/realtime/error`
- `thread/realtime/itemAdded`
- `thread/realtime/outputAudio/delta`
- `thread/realtime/sdp`
- `thread/realtime/started`
- `thread/realtime/transcript/delta`
- `thread/realtime/transcript/done`
- `warning`
- `windows/worldWritableWarning`
- `windowsSandbox/setupCompleted`

## Supported Requests (AgentMonitor -> App-Server, v2)

These are v2 request methods AgentMonitor currently sends to Codex app-server:

- `thread/start`
- `thread/resume`
- `thread/read`
- `thread/fork`
- `thread/list`
- `thread/archive`
- `thread/compact/start`
- `thread/name/set`
- `turn/start`
- `turn/steer` (used for explicit steer follow-ups while a turn is active)
- `turn/interrupt`
- `review/start`
- `model/list`
- `experimentalFeature/list`
- `collaborationMode/list`
- `mcpServerStatus/list`
- `account/login/start`
- `account/login/cancel`
- `account/rateLimits/read`
- `account/read`
- `skills/list`
- `app/list`

Notes:
- `turn/start` now forwards the optional `serviceTier` override (`"fast"` for `/fast`, `null` for default/off) alongside `model`, `effort`, and `collaborationMode`.

## Missing Client Requests (Codex v2 ClientRequest Methods)

Compared against Codex v2 request methods, AgentMonitor currently does not send:

- `account/logout`
- `account/sendAddCreditsNudgeEmail`
- `command/exec`
- `command/exec/resize`
- `command/exec/terminate`
- `command/exec/write`
- `config/batchWrite`
- `config/mcpServer/reload`
- `config/read`
- `config/value/write`
- `configRequirements/read`
- `device/key/create`
- `device/key/public`
- `device/key/sign`
- `experimentalFeature/enablement/set`
- `externalAgentConfig/detect`
- `externalAgentConfig/import`
- `feedback/upload`
- `fs/copy`
- `fs/createDirectory`
- `fs/getMetadata`
- `fs/readDirectory`
- `fs/readFile`
- `fs/remove`
- `fs/unwatch`
- `fs/watch`
- `fs/writeFile`
- `marketplace/add`
- `marketplace/remove`
- `marketplace/upgrade`
- `mcpServer/oauth/login`
- `mcpServer/resource/read`
- `mcpServer/tool/call`
- `memory/reset`
- `mock/experimentalMethod`
- `plugin/install`
- `plugin/list`
- `plugin/read`
- `plugin/uninstall`
- `skills/config/write`
- `thread/approveGuardianDeniedAction`
- `thread/backgroundTerminals/clean`
- `thread/decrement_elicitation`
- `thread/goal/clear`
- `thread/goal/get`
- `thread/goal/set`
- `thread/increment_elicitation`
- `thread/inject_items`
- `thread/loaded/list`
- `thread/memoryMode/set`
- `thread/metadata/update`
- `thread/realtime/appendAudio`
- `thread/realtime/appendText`
- `thread/realtime/listVoices`
- `thread/realtime/start`
- `thread/realtime/stop`
- `thread/rollback`
- `thread/shellCommand`
- `thread/turns/list`
- `thread/unarchive`
- `thread/unsubscribe`
- `windowsSandbox/setupStart`

## Server Requests (App-Server -> AgentMonitor, v2)

Supported server requests:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `item/permissions/requestApproval`
- `item/tool/requestUserInput`

Missing server requests:

- `account/chatgptAuthTokens/refresh`
- `item/tool/call`
- `mcpServer/elicitation/request`

## Strict Baseline

Prefer this order when validating protocol compatibility:

1. Generated TypeScript bindings:
   - `codex app-server generate-ts --experimental --out DIR`
2. Generated JSON Schema bundle:
   - `codex app-server generate-json-schema --experimental --out DIR`
3. Vendored upstream fixtures in this repo:
   - `.ref/codex/codex-rs/app-server-protocol/schema/typescript`
   - `.ref/codex/codex-rs/app-server-protocol/schema/json`
4. Source-level follow-up when generated artifacts are not enough:
   - `.ref/codex/codex-rs/app-server-protocol/src/protocol/common.rs`
   - `.ref/codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
   - `.ref/codex/codex-rs/app-server/src/bespoke_event_handling.rs`
   - `.ref/codex/codex-rs/app-server/README.md`

Why this order:
- `generate-ts` / `generate-json-schema` are emitted by the exact Codex build under test, so they are the safest static contract baseline.
- Source files remain necessary for emitter wiring and runtime semantics that schemas cannot express.

## Runtime Lifecycle Note

Static schema is necessary but not sufficient.

In a live probe against current Codex, a normal `turn/start` emitted:
- `thread/status/changed` -> `active`
- `turn/started`
- item lifecycle and delta events
- `thread/status/changed` -> `idle`

That probe did not emit `turn/completed`.

Implication for AgentMonitor:
- `thread/status/changed(type=idle)` is a critical completion signal.
- Do not assume `turn/completed` is always present.
- When debugging stuck "处理中…" states, inspect event ordering, not just schema shape.

## Where To Look In `.ref/codex`

Start here for the authoritative v2 notification list:
- `.ref/codex/codex-rs/app-server-protocol/src/protocol/common.rs`

Useful follow-ups:
- Notification payload types:
  - `.ref/codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
- Emitters / wiring from core events to server notifications:
  - `.ref/codex/codex-rs/app-server/src/bespoke_event_handling.rs`
- Human-readable protocol notes:
  - `.ref/codex/codex-rs/app-server/README.md`

## Quick Comparison Workflow

Use this workflow to update the lists above:

1. Get the current Codex hash:
   - `git -C .ref/codex rev-parse HEAD`
   - Or use the exact bundled/upstream tag under test when `.ref/codex` is stale.
2. List Codex v2 notification methods:
   - `awk '/server_notification_definitions! \\{/,/client_notification_definitions! \\{/' .ref/codex/codex-rs/app-server-protocol/src/protocol/common.rs | rg -N -o '=>\\s*\"[^\"]+\"|rename = \"[^\"]+\"' | sed -E 's/.*\"([^\"]+)\".*/\\1/' | sort -u`
3. List AgentMonitor routed methods:
   - `rg -n \"SUPPORTED_APP_SERVER_METHODS\" src/utils/appServerEvents.ts`
4. Update the Supported and Missing sections.

## Quick Request Comparison Workflow

Use this workflow to update request support lists:

1. Get the current Codex hash:
   - `git -C .ref/codex rev-parse HEAD`
   - Or use the exact bundled/upstream tag under test when `.ref/codex` is stale.
2. List Codex client request methods:
   - `awk '/client_request_definitions! \\{/,/\\/\\/\\/ DEPRECATED APIs below/' .ref/codex/codex-rs/app-server-protocol/src/protocol/common.rs | rg -N -o '=>\\s*\"[^\"]+\"\\s*\\{' | sed -E 's/.*\"([^\"]+)\".*/\\1/' | sort -u`
3. List Codex server request methods:
   - `awk '/server_request_definitions! \\{/,/\\/\\/\\/ DEPRECATED APIs below/' .ref/codex/codex-rs/app-server-protocol/src/protocol/common.rs | rg -N -o '=>\\s*\"[^\"]+\"\\s*\\{' | sed -E 's/.*\"([^\"]+)\".*/\\1/' | sort -u`
4. List AgentMonitor outgoing requests:
   - `perl -0777 -ne 'while(/send_request_for_workspace\\(\\s*&[^,]+\\s*,\\s*\"([^\"]+)\"/g){print \"$1\\n\"}' src-tauri/src/shared/codex_core.rs | sort -u`
5. Update the Supported Requests, Missing Client Requests, and Server Requests sections.

## Schema Drift Workflow (Best)

Use this when the method list is unchanged but behavior looks off.

1. Confirm the current Codex hash:
   - `git -C .ref/codex rev-parse HEAD`
   - Or use the exact bundled/upstream tag under test when `.ref/codex` is stale.
2. Inspect the authoritative notification structs:
   - `rg -n \"struct .*Notification\" .ref/codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
3. For a specific method, jump to its struct definition:
   - Example: `rg -n \"struct TurnPlanUpdatedNotification|struct ThreadTokenUsageUpdatedNotification|struct AccountRateLimitsUpdatedNotification|struct ItemStartedNotification|struct ItemCompletedNotification\" .ref/codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
4. Compare payload shapes to the router expectations:
   - Parser/source of truth: `src/utils/appServerEvents.ts`
   - Router: `src/features/app/hooks/useAppServerEvents.ts`
   - Turn/plan/token/rate-limit normalization: `src/features/threads/utils/threadNormalize.ts`
   - Item shaping for display: `src/utils/threadItems.ts`
5. Verify the ThreadItem schema (many UI issues start here):
   - `rg -n \"enum ThreadItem|CommandExecution|FileChange|McpToolCall|EnteredReviewMode|ExitedReviewMode|ContextCompaction\" .ref/codex/codex-rs/app-server-protocol/src/protocol/v2.rs`
6. Check for camelCase vs snake_case mismatches:
   - The protocol uses `#[serde(rename_all = \"camelCase\")]`, but fields are often declared in snake_case.
   - AgentMonitor generally defends against this by checking both forms (for example in `threadNormalize.ts` and `useAppServerEvents.ts`), while centralizing method/type parsing in `appServerEvents.ts`.
7. If a schema change is found, fix it at the edges first:
   - Prefer updating `src/utils/appServerEvents.ts`, `useAppServerEvents.ts`, and `threadNormalize.ts` rather than spreading conditionals into components.

## Notes

- Not all missing events must be surfaced in the conversation view; some may
  be better as toasts, settings warnings, or debug-only entries.
- For conversation view changes, prefer:
  - Add method/type support in `src/utils/appServerEvents.ts`
  - Route in `useAppServerEvents.ts`
  - Handle in `useThreadTurnEvents.ts` or `useThreadItemEvents.ts`
  - Update state in `useThreadsReducer.ts`
  - Render in `Messages.tsx`
- `turn/diff/updated` is now fully wired:
  - Routed in `useAppServerEvents.ts`
  - Handled in `useThreadTurnEvents.ts` / `useThreadEventHandlers.ts`
  - Stored in `useThreadsReducer.ts` (`turnDiffByThread`)
  - Exposed by `useThreads.ts` for UI consumers
- Steering behavior while a turn is processing:
  - AgentMonitor attempts `turn/steer` only when steer capability is enabled, the thread is processing, and an active turn id exists.
  - If `turn/steer` fails, AgentMonitor does not fall back to `turn/start`; it clears stale processing/turn state when applicable, surfaces an error, and returns `steer_failed`.
  - Local queue fallback on `steer_failed` is handled in the composer queued-send flow (`useQueuedSend`), not by all direct `sendUserMessageToThread` callers.
- Feature toggles in Settings:
  - `experimentalFeature/list` is an app-server request.
  - Toggle writes use local/daemon command surfaces (`set_codex_feature_flag` and app settings update),
    which write `config.toml`; they are not app-server `ClientRequest` methods.
