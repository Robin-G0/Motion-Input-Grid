# Motion Input Grid Studio Web

[English](studio-web.md) | [Français](studio-web.fr.md)

[Open Studio](https://robin-g0.github.io/Motion-Input-Grid/studio/). Create gestures,
assign keys and export a configuration without editing JSON. No account is needed.

## Your first movement

### Capture instead of drawing

1. Create or import a profile, then choose **Add a movement → Capture with the
   camera**. A new profile opens this choice for its first movement. Select the
   body part and **Normal**, **High tolerance** or **High precision**.
2. Start the camera. Keep both shoulders and the selected point visible until
   **Record take** becomes available.
3. Return to your starting pose and record the gesture **once per take**. Each
   take starts after **3–2–1** and ends after **five seconds**. Finish sooner with
   **S**, **Space** or **Finish this take**. Repeat for **three consistent takes**.
   **Blue cells** show the path as you move, with **S (green)** for the start and
   **F (yellow)** for the current finish. On subsequent takes, the previous
   successful path and its endpoints remain visible **in transparency**.
4. Test the generated green-to-yellow route. After a recognized gesture, choose
   **Choose a key**, then save through the usual key editor.

> [!TIP]
> **Normal is a useful starting point.** More tolerance widens regions and may
> overlap other movements; high precision is harder to repeat. Change the preset
> after capture and test again, or record again if the route is unsuitable.

An inconsistent or interrupted take is explained and retried; earlier good takes
are retained. Only the chosen point's positions are kept temporarily, not video.
Nothing changes in the profile until the result is accepted. Escape cancels and
releases the camera; switching tabs away also cancels.

The capture learns **2D paths with distinct start and finish positions**, not hand
signs, depth or a closed loop. For whole-body movement, open **Name and reference**
and choose **Starting position**. The generated result uses ordinary schema-v2
regions and can be adjusted in the editor. No new runtime or file format is needed.

### Draw the route yourself

1. Choose **Guide me step by step** for on-screen instructions, or **New profile →
   Draw the route**. For an existing profile, choose **Add a movement → Draw the route**.
   The guide builds a movement named **HI**. A spotlight identifies the current control; the rest is dimmed and inactive. **Leave the guide** returns to normal editing. Steps advance after edits and successful recognition.
2. Choose the body point to move, for example your left wrist.
3. Select green **Required** and draw a starting region. Select yellow **Trigger**
   and draw the finishing region. The gesture travels from green to yellow.
   Keep both shoulders visible to establish the grid. The camera switch helps
   you check your position before drawing.
4. Choose **Test this movement**, then **Start camera**. Allow camera access and
   follow the path. The journal confirms recognised actions. Return to editing
   if you need to adjust the regions. Nothing is typed into other applications.
5. Choose **Continue: assign keys** (or **Assign keys** in the editor).
6. The keyboard editor starts empty. Click **+ Add a key / next step**, then select **Right** or capture Right Arrow, with mode **Once**. No default key is inserted. Use the + inside a row for another simultaneous key, or the bottom + for a sequential row.
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
[Controller download and screenshot guide](https://robin-g0.github.io/Motion-Input-Grid/studio/controller/?lang=en).
Direct Windows x64 and Linux x64 downloads appear when the latest public release
contains Controller-only files. Until then, the page explains the situation and
links to the available release. Older archives must be fully extracted and kept
together; open only the Controller, not desktop Studio.

1. Run the Controller. If SmartScreen appears, verify the official download.
   **More info**, then **Run anyway** may be offered if you choose to trust it.
   Do not disable Windows protection. On Linux, allow the `.run` file to run
   as a program in its properties. Keyboard output requires X11, not Wayland.
2. Choose **Import profile** (under **Manage profile** for an existing library), select `mig-profile.json` and review the bindings.
3. Start tracking with keyboard output off. Check the correct movement lights up,
   then enable **Keyboard: On** and focus the presentation or target application.

The standalone Controller contains its runtime and models in one download.
Windows keeps a verified runtime cache under Local AppData and checks it before
each reuse; Linux extracts temporary files and removes them on normal exit.
OS camera and display facilities remain necessary; Linux needs glibc 2.35 or
later. No compiler, Python or desktop Studio installation is needed.

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

## The guided HI walkthrough

The guide asks you to name HI, select Left wrist, draw the marked lower starting band and upper finishing band, then test the gesture. Keep your shoulders visible and move your left wrist from green into yellow. Recognition unlocks keyboard assignment. Explicitly add Right Arrow, save, then repeat the gesture in the complete-configuration test. Check HI and Right in the journal before exporting. The final guide links directly to the Controller download and import instructions.

The download page shows three real Windows application screenshots directly below its buttons: an empty Controller with Import profile visible, the HI import review, and HI with keyboard consent enabled. The last screenshot has not started camera capture. Linux placement differs. Screenshot sources and the real executable hash are recorded in `site/studio/controller/images/capture.json`; regenerate with `tools/dev/capture-controller.py` from the binary branch after relevant native UI changes.

On first Windows launch, the standalone file explains where it will extract its runtime. Copy the actual path if needed, then choose Continue. Later launches reuse the verified directory. Close MIG before deleting that directory for cleanup; the next launch recreates it. Your profiles are separate.

For developers, the [complete JSON reference](../reference/configuration.md) describes supported fields and defaults. The complete [HI profile](../../configs/studio-hi.json) is tested through the actual schema parser.
