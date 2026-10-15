# Motion Input Grid Studio Web

[English](studio-web.md) | [Français](studio-web.fr.md)

[Open Studio](https://robin-g0.github.io/Motion-Input-Grid/studio/). Create gestures,
assign keys and export a configuration without editing JSON. No account is needed.

## Your first movement

1. Choose **Guide me step by step** for on-screen instructions, or **New profile**.
   Name your first movement, for example “Next slide”.
2. Choose the body point to move, for example your left wrist.
3. Select green **Required** and draw a starting region. Select yellow **Trigger**
   and draw the finishing region. The gesture travels from green to yellow.
   Keep both shoulders visible to establish the grid. The camera switch helps
   you check your position before drawing.
4. Choose **Test this movement**, then **Start camera**. Allow camera access and
   follow the path. The journal confirms recognised actions. Return to editing
   if you need to adjust the regions. Nothing is typed into other applications.
5. Choose **Continue: assign keys** (or **Assign keys** in the editor).
6. For a presentation, add a key press and keep **Right**, with the mode **Once**.
   Choose **Save and return to movements**.

## Keys, shortcuts and sequences

Keys on one row are pressed **together**. Rows run **from top to bottom**.
The preview shows the configured operations.

- A single key: one row containing **Right**.
- A shortcut: capture **Ctrl+C**, or add **Ctrl** and **C** to the same row.
- A sequence: separate rows containing **Ctrl+C**, **Right**, **Right**.
- Text: a text row, optionally followed by a row containing **Enter**.

Use **Move up**, **Move down** and **Delete** to arrange rows. The × button
removes one key. If the browser reserves a shortcut and prevents capture, use
the selector. Capture uses the typed letter; select punctuation explicitly.

**Once** runs once per accepted gesture. **Hold** runs preceding rows once and
holds the final shortcut while the pose stays active; the last row must contain
keys. **Repeat** repeats the sequence while the pose stays active at the chosen
interval. Start with **Once**. An empty sequence produces a logical action only.

## Manage and test

**Movements** lists saved movements and keys. Add, edit, test or delete movements.
**Undo** restores a deletion. Changes are kept as a local draft when storage is
available. **Test the whole configuration**, then **Start camera**, recognises
all movements. The journal shows each action and the keyboard operations that
would be sent. A test opened from a movement card only recognises that movement.
Neither test sends real keys.

## Export and use the Controller

Choose **Export** and keep `mig-profile.json`. The reminder links to the
[Controller download and illustrated guide](https://robin-g0.github.io/Motion-Input-Grid/studio/controller/?lang=en).
Direct Windows x64 and Linux x64 downloads appear when the latest public release
contains Controller-only files. Until then, the page explains the situation and
links to the available release. Older archives must be fully extracted and kept
together; open only the Controller, not desktop Studio.

1. Run the Controller. If SmartScreen appears, verify the official download.
   **More info**, then **Run anyway** may be offered if you choose to trust it.
   Do not disable Windows protection. On Linux, allow the `.run` file to run
   as a program in its properties. Keyboard output requires X11, not Wayland.
2. Choose **Import profile**, select `mig-profile.json` and review the bindings.
3. Start tracking with keyboard output off. Check the correct movement lights up,
   then enable **Keyboard: On** and focus the presentation or target application.

The standalone Controller contains its runtime and models in one download. It
extracts temporary files while running and removes them on exit. OS camera and
display facilities remain necessary; Linux needs glibc 2.35 or later. No compiler,
Python or desktop Studio installation is needed.

## Useful details

Images are processed on your device. Initial loading downloads models and the
engine; camera access requires HTTPS or localhost. The website does not install
itself for offline use and cannot type into other applications.

Grid-only mode supports zoom and scrolling. Notes are separate from gesture
regions. Copy/paste duplicates selected regions; Ctrl+A, Ctrl+Z and Ctrl+Y select,
undo and redo. Advanced settings include fingers and timing. JSON remains an
optional advanced editor.

Drafts belong to one browser and origin (scheme, hostname and port). Export a
durable copy before clearing storage or moving devices. Drafts are not synced
to an account.
