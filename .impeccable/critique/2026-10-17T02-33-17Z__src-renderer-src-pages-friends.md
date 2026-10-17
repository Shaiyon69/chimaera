---
target: src/renderer/src/pages/friends
total_score: 23
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\shaiyon\\Documents\\Projects\\chimaera\\src\\renderer\\src\\pages\\friends"
timestamp: 2026-10-17T02-33-17Z
slug: src-renderer-src-pages-friends
---

Method: dual-agent (A: af8963d096d94e1f0 · B: aec82c2d5cc628660)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                   |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Send button gives no "sending" label, only disables                                         |
| 2         | Match System / Real World       | 2         | "MESSAPP" surfaces as a user-facing brand inside Chimaera chrome, unexplained               |
| 3         | User Control and Freedom        | 2         | No cancel affordance on the armed remove-friend state; no escape from a stuck unlock screen |
| 4         | Consistency and Standards       | 2         | Destructive remove-friend reinvents confirm instead of the app's own Modal pattern          |
| 5         | Error Prevention                | 2         | Remove-friend gets a (weak) confirm; decline/cancel-outgoing get none                       |
| 6         | Recognition Rather Than Recall  | 3         | PIN field has hint text but is pure masked recall, no grouping                              |
| 7         | Flexibility and Efficiency      | 3         | Standard form submit, no shortcuts — acceptable for scope                                   |
| 8         | Aesthetic and Minimalist Design | 3         | Clean, token-driven, uncluttered                                                            |
| 9         | Error Recovery                  | 2         | Generic `action_failed` collapses every failure; sign-in sometimes leaks raw SDK error text |
| 10        | Help and Documentation          | 1         | No in-app path to create a MESSAPP account or set a PIN                                     |
| **Total** |                                 | **23/40** | **Acceptable**                                                                              |

## Design Specificity Verdict

**LLM assessment**: Mostly authored for Chimaera, not a dropped-in template. It reuses the house `Button`/`TextField`/`Avatar` components throughout, `friends.scss` follows the Token-Only Rule (`var(--fill)`, `var(--accent)`, `var(--text)`, `globals.$spacing-unit`), and the narrow-window stacking via `@container #{globals.$app-container}` (friends.scss:13-17) shows real integration with the app's resizable-window system rather than a lifted web layout.

Two drift points pull it toward "generic chat app": the remove-friend control invents its own double-click-arm pattern instead of the app's existing `Modal`-based confirm (see `delete-game-modal.tsx`), and `.friends__bubble`'s 14px radius (friends.scss:144) matches no DESIGN.md radius token (6/8/9/10/11/16/999px) — an undocumented shape introduced for chat bubbles, which the system has never had before.

**Deterministic scan**: The bundled detector (`impeccable detect --json`) returned `[]` — zero rule hits, exit code 0. A targeted grep pass across all 4 files found **zero** hard-coded hex/rgb/hsl colors (every color is a token or SCSS variable) and **zero** interactive elements missing a visible label or `aria-label`. `role="alert"` (friends-list.tsx:90, chat-panel.tsx:224), `role="log"` + `aria-live="polite"` (chat-panel.tsx:197-198) are present; no `tabIndex` overrides anywhere (expected — nothing here needs one). 7 onClick handlers call into a shared `run()` helper without an try/catch in their own immediate closure, but `run()` itself wraps the call, so this is not a real gap — noted as a false-positive-shaped pattern rather than a defect.

**Visual overlays**: Not available. No browser automation tool is exposed in this session, and this is a native Electron surface rather than a plain browsable URL, so no live screenshot or injected overlay was possible. This critique is source-only.

## Overall Impression

The page is unusually well-integrated into Chimaera's token system for a brand-new surface — color and spacing discipline is clean, and the one moment that most needed trust-building (the PIN unlock) has genuinely reassuring, accurate copy. But the page currently has no way in for a first-time user who doesn't already have a MESSAPP account and PIN, and its error handling flattens every failure into one of two generic strings (occasionally leaking raw SDK text instead). The biggest opportunity: decide whether "MESSAPP" should ever be user-visible branding, or whether this should read as a first-party Chimaera "Friends" feature with the backend fully hidden, the way the rest of the app never names its infrastructure.

## What's Working

- **The unlock screen's trust copy is backed by real behavior, not just wording.** `unlock_description` ("Chimaera only reads your key backup and never changes it") matches the actual read-only guarantee documented in `unlockKeyring`'s comment (api.ts:162-165). This is rare: most apps write reassuring copy without the implementation to back it.
- **Full token discipline in a brand-new surface.** Every color in `friends.scss` is `var(--token)` or a `globals.$` SCSS variable — confirmed by the detector and an independent grep (zero hard-coded colors found). The container-query responsive stacking (friends.scss:13-17) shows it was built against the app's actual windowing, not assumed-fixed-width.
- **Draft preservation on send failure** (chat-panel.tsx:184): a failed message keeps its text in the composer for retry instead of clearing it — a small empathy win most chat UIs skip.

## Priority Issues

**[P0] No onboarding or account-creation path for first-time users.**
Why it matters: `SignInForm` (friends.tsx:12-62) assumes the user already has a MESSAPP account and has already set a 6-digit PIN there. Anyone without one hits a dead end on the very first screen, with no explanation of what MESSAPP is or how to get an account.
Fix: Add explainer copy and a path to create/link a MESSAPP account, or at minimum a "what is this" link, before shipping this to users who don't already use MESSAPP.
Suggested command: /impeccable onboard

**[P0] Generic and occasionally leaky error messages (heuristic #9).**
Why it matters: `run()` (friends-list.tsx:50-58) collapses every failure — network error, blocked action, server rejection — into one `action_failed` string, so users can't tell a retryable glitch from a real block. Separately, `SignInForm`'s catch (friends.tsx:26-32) can render a raw SDK error message verbatim on a password screen, which risks looking alarming or technical at the worst possible moment.
Fix: Map known error codes to specific, calm copy; never pass raw SDK/network error text directly into user-facing UI.
Suggested command: /impeccable harden

**[P1] Destructive remove-friend reinvents confirmation instead of reusing the app's own Modal pattern.**
Why it matters: `friends-list.tsx:179-197` arms a danger state on the first click and fires on the second, only disarmed by blur (an invisible contract to the user). The app already has a correct, familiar pattern for this exact situation (Modal + Cancel/Danger buttons, see `delete-game-modal.tsx`), and this page doesn't use it — inconsistent with Consistency/Standards and weaker on Error Prevention than the rest of the app.
Fix: Replace the double-click-arm button with the existing `Modal`-based confirmation component.
Suggested command: /impeccable polish

**[P1] Friend-row action buttons have no distinguishing accessible name, and the PIN hint isn't wired to its field.**
Why it matters: Every remove/accept/decline button in a friend list says only "Remove"/"Accept"/"Decline" with no bound username (friends-list.tsx:141-150, 179-197, 214-219) — a screen-reader user tabbing a long list hears a wall of identical controls. Separately, the PIN field (chat-panel.tsx:59-68) has an `aria-label` but no `aria-describedby` linking it to its hint/error text, so assistive-tech users miss the trust-building copy sighted users get.
Fix: Give each action button an `aria-label` that includes the friend's name (e.g. `t("remove_named", { name })`); wire the PIN field's hint/error to `aria-describedby`.
Suggested command: /impeccable audit

**[P2] An undocumented shape value entered the system.**
Why it matters: `.friends__bubble`'s 14px border-radius (friends.scss:144) doesn't match any of DESIGN.md's declared radii (6/8/9/10/11/16/999px). Minor by itself, but it's unreviewed drift in a system whose whole point is token-only shapes — and chat bubbles are a new component type DESIGN.md doesn't document at all.
Fix: Either snap to an existing radius token or add "Chat Bubble" as a documented Components entry in DESIGN.md with its own value.
Suggested command: /impeccable document

## Persona Red Flags

**Jordan (First-Timer)**: Stalls immediately at `SignInForm` with no MESSAPP account and no way to get one from inside Chimaera. Assuming he has an account: signs in, picks a friend, reaches `UnlockForm`, has no PIN set yet — told "No key backup found. Set a PIN in MESSAPP first." (translation.json `no_backup`) with no link to that app. If he has a PIN and mistypes it, "Incorrect PIN." gives no retry count and no recovery path — he will plausibly conclude the feature is broken and leave.

**Sam (Accessibility-Dependent)**: The message log correctly uses `role="log"` + `aria-live="polite"` (chat-panel.tsx:197-198) — a genuine, specific win. But tabbing through a friend list, every action button announces only a bare verb ("Remove", "Accept", "Decline") with no name attached, so Sam can't tell which friend a given control acts on without tracking position by count. The PIN screen's reassurance paragraph (`unlock_description`) is sighted-only text with no `aria-describedby` link to the input, so Sam gets none of the trust-building copy the design review flagged as this flow's strongest moment.

## Minor Observations

- Message timestamps exist only as a hover `title` tooltip (chat-panel.tsx:211) — invisible to keyboard, touch, and assistive-tech users.
- The friends cache writes straight to `localStorage` (use-messapp.ts:8-16), bypassing the app's LevelDB persistence conventions (CLAUDE.md) — a backend consistency note more than a design one, but it underscores that this feature hasn't been fully folded into house patterns anywhere, UI included.
- No unread-message indicator in the friend list for a friend whose chat isn't currently open.
- 7 onClick handlers delegate into a shared `run()` wrapper that itself has try/catch; not a defect, but worth knowing if future refactors assume every handler is self-contained.

## Questions to Consider

- Why does "MESSAPP" ever appear as user-facing branding — shouldn't this read as a first-party Chimaera "Friends" feature with the backend name fully hidden, the way the rest of the app never names its infrastructure?
- Was shipping with no onboarding path for users without an existing MESSAPP account/PIN an accepted v1 scope cut, or was it missed?
- Was reinventing the remove-friend confirmation a deliberate trade-off, or was the existing `Modal` pattern simply not discovered during the build?
