---
target: main desktop UI
total_score: 20
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\shaiyon\\Documents\\Projects\\chimaera\\src\\renderer\\src"
timestamp: 2026-10-16T11-46-59Z
slug: src-renderer-src
---

Method: dual-agent (A: design-review subagent, B: detector subagent), plus a separate technical-audit subagent. Browser visualization was skipped because no browser automation tool was exposed and the target is an Electron app. All findings come from reading the source.

## Design Health Score

| #     | Heuristic                       | Score | Key Issue                                                                                                                                                 |
| ----- | ------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Visibility of System Status     | 2     | The bottom-panel download status is good. Play has no launching state, and the running-game indicator is hidden in the dock (nav-dock.scss:80-81).        |
| 2     | Match System / Real World       | 2     | Jargon and meme copy ("repack", "Conceal", "Such empty"). "Close" means kill the game.                                                                    |
| 3     | User Control and Freedom        | 2     | Esc closes modals. There is no undo for "Remove from library", and the dock profile button does nothing (sidebar-profile.tsx:227-230).                    |
| 4     | Consistency and Standards       | 2     | macOS traffic lights appear on Windows/Linux. "Options" and "Properties" open the same modal. Two styling eras coexist (Hydra 4px radii and glass pills). |
| 5     | Error Prevention                | 3     | The download modal checks disk space and write permission before enabling its button.                                                                     |
| 6     | Recognition Rather Than Recall  | 2     | The dock is icon-only with hover labels. Repack availability is shown by colour only.                                                                     |
| 7     | Flexibility and Efficiency      | 1     | There are no app shortcuts and no batch actions.                                                                                                          |
| 8     | Aesthetic and Minimalist Design | 2     | The library toolbar has 11 controls. The Danger Zone has 5 equally red buttons.                                                                           |
| 9     | Error Recovery                  | 2     | A failed catalogue search silently keeps stale results, a failed home row stays empty, and toasts last 3s.                                                |
| 10    | Help and Documentation          | 2     | The guide links point to Hydra's knowledge base (app.tsx:238-242).                                                                                        |
| Total |                                 | 20/40 | Acceptable                                                                                                                                                |

## Design Specificity Verdict

The UI is interchangeable with other launchers: it is the Hydra layout with an Apple-style dark glass skin. Styling is split between two eras: Hydra cloud gradients and 4px radii next to glass pills. There are 23 font sizes and about 200 hard-coded hex colours. The default OLED preset uses a white accent, so the product has no colour identity. The only character is in Classics: the rainbow bookmark stripes and the PS disc avatar overlay, which the dock hides.

The detector reported 7 findings, of which 6 are true positives:

- bounce-easing x4: fullscreen-media-modal.scss:67, gallery-lightbox.scss:72 and :125, souvenir-lightbox.scss:87.
- side-tab x2: optiscaler-section.scss:22, settings-optiscaler.scss:77.
- One false positive: select-field.scss:47 is a transparent spacer.

## Overall Impression

The foundations are solid: a virtualized library, a token system, real buttons and jsx-a11y. The leftovers from removing the account create dead ends, and launching a game, the core action, gets the weakest feedback.

## What's Working

- The download settings modal checks for problems before it lets the user start.
- The token and theme layering (scss/tokens.scss, themes.ts).
- Keyboard-friendly header search.

## Priority Issues

- [P1] Account-removal leftovers: the dead dock avatar, orphaned Notifications and Profile, "Sign in to ..." gates on achievements, reviews and artwork, and controls disabled without a reason. Command: clarify.
- [P1] Modal, toast and progress accessibility: no aria-modal, aria-labelledby or focus trap/restore across about 40 modals; no live region on toasts; no progressbar role. Command: harden.
- [P1] Launching is invisible: Play is outline-styled like Favorite, there is no launching state, and the running indicator is hidden. Command: bolder.
- [P1] Contrast and zoom: the primary button is 2.4-3.65:1 in the Glass, Crimson and Midnight presets; --faint text is 2.6:1; read notifications are 1.97:1; removeMenu() disables zoom. Commands: colorize, adapt.
- [P2] Desktop conventions and power use: macOS traffic lights on Windows; no shortcuts; an 11-control library toolbar; 5 red Danger Zone buttons. Commands: adapt, distill.

## Persona Red Flags

- Alex (power user): no shortcuts, no batch actions, and a three-modal download flow.
- Sam (keyboard and screen reader): unnamed icon buttons in the header, hero and dock; context-menu focus is invisible; no aria-current; Framer Motion ignores reduced motion.
- Jordan (first-timer): a dead first dock item, labels on hover only, empty states with no call to action, and jargon.

## Minor Observations

- Hard-coded English strings.
- console used instead of logger.
- backdrop.scss:26 has a unitless calc.
- Inverted $muted-color and $body-color tokens.
- Hard-coded skeleton colours.
- The full-window backdrop-filter is animated.
- "Clear all" notifications has no confirmation.
- Dead cloud code in bottom-panel.

## Questions to Consider

- Should the Classics visual language become the brand?
- What belongs in the dock's top slot without an account?
- Could "Download" be one click with a smart default?

## Audit (technical): 12/20, Acceptable

Scores: Accessibility 2, Performance 3, Theming 3, Responsive 2, Implementation Integrity 2.

Issue counts: 0 P0, 9 P1, 11 P2, 6 P3.
