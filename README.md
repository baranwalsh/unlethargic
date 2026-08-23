# UnLethargic

A minimalist, sepia/ledger-and-receipt styled task & time-agenda manager, built as a native-feeling Mac app with Electron.

- **Left column ("The Ledger")** — add tasks with an optional due date, an optional estimated time (hours/minutes), and optional subtasks.
- **Right column ("Today's Agenda")** — set how many hours you want to work today, then drag tasks from the ledger into the paper-receipt-styled agenda. It tallies allocated time vs. remaining budget as you go.
- **Confirm agenda** to lock it in, then use the timer (▶ pause ⏭ skip ↺ reset) to work through it. Pausing starts a "wasted time" counter that's added back onto the agenda, shown at the bottom of the receipt.
- Everything autosaves locally (no account, no internet needed).

## Why you're getting source, not a .dmg

Building a macOS `.dmg` requires Apple's toolchain (or `electron-builder` running on macOS), which only exists on an actual Mac — it can't be produced in the sandboxed environment this was written in. The good news: turning this into your `.dmg` takes about 3 commands on your own Mac, no coding required.

## No Terminal / no admin? Build it in the cloud instead

This repo includes `.github/workflows/build-mac.yml`, a GitHub Actions workflow that builds the `.dmg` on a free macOS machine in the cloud — nothing runs on your laptop except your browser. See the walkthrough in chat, or:

1. Create a free GitHub account.
2. Make a new repo and upload this whole folder via **Add file → Upload files** (drag the folder in — GitHub keeps the structure).
3. Commit. The workflow runs automatically — watch it under the **Actions** tab (~3–5 min).
4. Download the `.dmg` from the finished run's **Artifacts** section.
5. Open the `.dmg` and drag the app to your Desktop (or anywhere you can write to) instead of Applications — it runs fine from there.
6. First launch: right-click the app → **Open** (not double-click) since it's unsigned. One-time only.

## Build it into a .dmg (on your Mac, if you do have Terminal)

1. **Install Node.js** if you don't have it: https://nodejs.org (LTS version), or `brew install node`.
2. Open Terminal, `cd` into this folder (the one with `package.json`), then run:
   ```bash
   npm install
   npm run dist
   ```
3. When it finishes, look in the new `dist/` folder — you'll find **`UnLethargic-1.0.0.dmg`**. Double-click it, drag the UnLethargic icon into Applications, done.

That first build may take a couple of minutes (Electron is a few hundred MB). After that, `npm run dist` alone rebuilds it any time you tweak the code.

### If macOS blocks the app on first open

Since this isn't signed with an Apple Developer certificate, right-click the app the first time and choose **Open** (instead of double-clicking) — macOS will let you bypass Gatekeeper with a confirmation. This is only needed once.

### Optional: custom app icon

Drop a 1024×1024 `icon.icns` file at `build/icon.icns` and re-run `npm run dist` — electron-builder will pick it up automatically (see the `build.mac.icon` field you can re-add in `package.json`).

## Try it without building anything first

Just to preview the UI/interactions instantly in any browser, open `src/index.html` directly — everything (drag-and-drop, timer, receipt math) runs client-side with no build step. The only thing you lose outside Electron is the native app wrapper/dock icon/.dmg installer.

## Project structure

```
UnLethargic/
├── main.js          # Electron entry point (creates the window)
├── preload.js       # (minimal — app uses localStorage directly)
├── package.json     # electron-builder config lives under "build"
└── src/
    ├── index.html   # UI structure + all styling
    └── app.js       # state, rendering, drag/drop, timer logic
```
