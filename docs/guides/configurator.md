# MIG Studio

MIG Studio is the desktop editor. Its executable remains `mig-configurator` for
compatibility with existing releases and scripts. Prefer
[MIG Studio Web](studio-web.md) for browser-based drawing, import and camera tests.
Use the desktop editor for native recording and operating-system keyboard tests.

[English](configurator.md) | [Français](configurator.fr.md)

<details>
<summary>On this page</summary>

- [Find and launch the application](#find-and-launch-the-application)
- [Example: raise a hand to advance a presentation](#example-raise-a-hand-to-advance-a-presentation)
- [Create your first profile](#create-your-first-profile)
- [Check and use the profile](#check-and-use-the-profile)
- [Build from source](#build-from-source)

</details>

The Motion Input Grid (MIG) MIG Studio turns drawn body movements into JSON
profiles. Choose a tracked body part, draw its route and set the action to emit.
Run the saved profile in the [MIG Input](controller.md) or an application using MIG.

## Find and launch the application

> [!NOTE]
> On Debian, the MIG Studio, MIG Input and some native examples are still
> being developed and tested. They may not yet work fully.

In [Releases](https://github.com/Robin-G0/Motion-Input-Grid/releases), choose a matching native
archive when available:

| System | Archive | File after extraction |
| --- | --- | --- |
| Windows x64 | `motion-input-grid-<version>-windows-x64-native.zip` | `windows/mig-configurator.exe` |
| Linux x64 | `motion-input-grid-<version>-linux-x64-native.tar.gz` | `./mig-configurator` |

Paths start at the extracted archive's main folder. On Windows, open the executable.
On Linux, open a terminal in that folder and run `./mig-configurator`; this launcher
sets up the bundled libraries before starting the binary in `bin/`. Keep the
archive's DLLs, models, configurations and other resources together. Windows
requires the Visual C++ 2022 x64 runtime; Linux archives require glibc 2.35+.

## Example: raise a hand to advance a presentation

A **profile** is a file containing your movements. An **input** describes one
movement and its action; a **layer** contains the regions for one tracked body
part. An input can have several layers.

1. Start the camera, keep both shoulders visible for calibration, then add an
   input named `Next slide` and select your wrist as its tracked body part.
2. Draw 🟩 **Required** regions upward from your hand's resting position.
   Number them in movement order and place a 🟨 **Trigger** region above them.
   Wide regions give your movement more room.
3. Set the action to `next_slide`, the key to `Right` and the mode to **Single press**.
   Match the key to your presentation application's shortcut.
4. On Windows, use **Save layer**, then **Apply** and **File → Save**.
   On Linux, save the profile from the main interface.
5. Stop the MIG Studio's camera, import the file in the [MIG Input](controller.md)
   and check the visual feedback before enabling **Keyboard output**.
   Then focus your presentation.

Lower your hand before repeating the movement. To start with a drawn route,
open [raised-hands.json](../../examples/common/raised-hands.json), then add your
shortcut to the chosen input. The sample supplies two wrist routes, enables hand
tracking and needs a hands-enabled build. It sends no keys until you add a binding.

### Choose what the keyboard does

| Mode | Behavior |
| --- | --- |
| Single press | Executes the sequence once when the movement is accepted. |
| Hold | Keeps the final shortcut pressed until the trigger's live conditions end. |
| Repeat | Repeats the sequence while conditions remain valid, at your chosen interval. |

In the keys field, `Ctrl + C` is a simultaneous shortcut;
`"Hello world" _ Enter` types the text then presses Enter. `A _ A` presses A
twice. A Hold sequence must end with a shortcut rather than text.
The [keyboard reference](../reference/configuration.md#action-output-modes)
explains sequence behavior and limits.

## Create your first profile

1. Open the MIG Studio and start the camera. Keep both shoulders visible during calibration.
2. Add an input. On Windows, **Add/Edit** opens its drawing editor; Linux uses the sidebar.
3. Choose the tracked body part, such as a wrist, and draw its regions on the grid.
4. Set the input name, action and optional keyboard binding.
5. Save the profile as JSON. On Windows, apply the input to the document before **File → Save**.
6. Stop the camera, open the MIG Input and import the saved profile.

Region colors describe their conditions:

| Color | Condition |
| --- | --- |
| 🟩 Green — Required | Visit this region; numbered regions specify the route's order. |
| 🟥 Red — Forbidden | Avoid this region. |
| 🟨 Yellow — Trigger | Complete the movement here to emit its action. |
| 🟪 Purple — Interaction | Perform the selected hand sign in this region, optionally holding it. |

On Windows, use **Save layer** after changing a layer's body part; **Apply** saves
that input into the open document, and **File → Save** writes the JSON file.
**Advanced** exposes hand signs, finger rules and advanced constraints. Linux separates
**Movements** from **Draw zones**; sign and hold settings appear with Interaction,
and ordered-route settings appear for Required zones in an ordered movement.
Complete fields remain available through **File → Advanced: complete JSON profile…**;
its drawing tools differ from Windows.
The [Windows controls](../getting-started/windows.md#workspace-and-drawing) and
[Linux controls](../getting-started/linux.md) describe the available tools.

## Check and use the profile

Use **Select** and drag with the left button held to select a rectangle on the
current layer. Hold **Ctrl** to retain the previous selection. Press **Delete**
to remove the selected regions and their linked tolerances. On Linux, use the
full-grid view for selection. On Windows, **Tolerance** targets the region you
click, including its existing tolerance; no prior selection is needed.

Basic/Advanced switches preserve the input's conditions. Removing a purple region
removes its own sign and finger rules, but independent whole-input and step
finger rules still apply. The binding summary shows these rules. Use
**Clear fingers** on Windows or **Clear all finger rules** on Linux to remove
finger conditions across all scopes;
this leaves the regions and purple hand signs in place. On Windows, the Advanced
finger scope selector also shows each scope's rule count. After editing, apply
the input again before testing and save the document to persist it.

Keep your shoulders visible so the grid can follow your body. Try the movement
and watch for action feedback. Use the [hand tracking guide](hands.md) for signs
and finger conditions. Close one application's camera before opening the other's.

Keyboard output starts disabled. The MIG Input guide explains how to enable it
and use Single press, Hold and Repeat. **View** controls the theme, preview overlays
and logs. The [configuration reference](../reference/configuration.md) describes
all saved fields and action modes.

## Build from source

After building from source:

| Method | File relative to the repository root |
| --- | --- |
| Windows `release` preset | `build/release/bin/mig-configurator.exe` |
| Default `tools/build/build-windows.ps1` script | `build/windows/bin/mig-configurator.exe` |
| Linux guide's build | `build/linux-apps/bin/mig-configurator` |

Follow the [Windows](../getting-started/windows.md) or
[Linux](../getting-started/linux.md) guide to build. The Linux guide also supplies
`--runtime` to locate models and the MediaPipe library. The `sdk-*` presets and
library packages do not build these applications.
