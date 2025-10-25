# ADR 0015: Window State Persistence

## Status

Accepted

## Context

StemPacker's desktop shell previously launched with Electron's default window bounds (1280×720)
without remembering user adjustments. Artists who resized or repositioned the window needed to
repeat that work on every launch, and the larger default width wasted horizontal space on modest
laptops. We want a friendlier default footprint and to reopen exactly where users left off between
sessions while ensuring the window never renders off-screen when monitor configurations change.

## Decision

* Set the primary BrowserWindow default to 1000×700 to better match the density of the dark UI while
  leaving enough room for the packing workflow.
* Persist window bounds under the Electron `userData` directory using a lightweight JSON helper and
  restore those bounds on startup when available.
* Clamp restored bounds to the primary display's work area before constructing the BrowserWindow so
  multi-monitor changes cannot strand the UI off-screen.
* Debounce resize/move writes and also persist immediately on close to avoid unnecessary disk churn
  while capturing the latest geometry.

## Consequences

* Users retain their preferred window size and position between sessions with sensible defaults the
  first time they open the app.
* The main process now touches `window-state.json` alongside other persisted settings, so installers
  should include that file in troubleshooting captures when investigating layout issues.
* Future multi-window work will need to extend the helper to track additional window identifiers or
  opt into separate state files.
