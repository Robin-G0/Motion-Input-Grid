# Motion Input Grid Studio

Motion Input Grid Studio is the desktop editor. Prefer
[Studio Web](https://robin-g0.github.io/Motion-Input-Grid/studio/) for browser-based drawing, import and camera tests without installation.
Use the desktop editor to configure and test operating-system keyboard output.

[English](configurator.md) | [Français](configurator.fr.md)

<details>
<summary>On this page</summary>

- [Find and launch the application](#find-and-launch-the-application)
- [Example: raise a hand to advance a presentation](#example-raise-a-hand-to-advance-a-presentation)
- [Create your first profile](#create-your-first-profile)
- [Check and use the profile](#check-and-use-the-profile)
- [Build from source](#build-from-source)

</details>

Motion Input Grid Studio turns drawn body movements into JSON
profiles. Choose a tracked body part, draw its route and set the action to emit.
Run the saved profile in the [Motion Input Grid Controller](controller.md) or an application using MIG.

> [!TIP]
> **Just want to control a presentation?** Follow the [presentation guide](presentations.md)
> for a route without code. Here, Studio **draws** movements and Controller **runs** them.

## Find and launch the application

> [!NOTE]
> On Debian, the Motion Input Grid Studio, Motion Input Grid Controller and some native examples are still
> being developed and tested. They may not yet work fully.

Download for your system. The same package includes Studio and Controller:

| System | Download v1.1.0 | Open after extraction |
| --- | --- | --- |
| Windows x64 | [Download ZIP](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) | `windows/motion-input-grid-studio.exe` |
| Linux x64 | [Download tar.gz](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) | `./motion-input-grid-studio` |

Paths start at the extracted archive's main folder. On Windows, open the executable.
On Linux, open a terminal in that folder and run `./motion-input-grid-studio`; this launcher
sets up the bundled libraries before starting the binary in `bin/`. Keep the
archive's DLLs, models, configurations and other resources together. Windows
requires the [latest Visual C++ x64 runtime](https://aka.ms/vc14/vc_redist.x64.exe); Linux archives require glibc 2.35+.

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
4. On Windows, use **Apply** and **File → Save**.
   On Linux, save the profile from the main interface.
5. Stop the Motion Input Grid Studio's camera, import the file in the [Motion Input Grid Controller](controller.md)
   and check the visual feedback before enabling **Keyboard output**.
   Then focus your presentation.

Lower your hand before repeating the movement. To start with a drawn route,
open [raised-hands.json](../../examples/common/raised-hands.json), then add your
shortcut to the chosen input. The sample supplies two wrist routes, enables hand
tracking and needs a hands-enabled build. It sends no keys until you add a binding.

> [!NOTE]
> For Canva, PowerPoint, PDF or another slideshow, **try the key on your physical
> keyboard first**. The shortcut depends on the viewer and presenting mode.

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

1. Open the Motion Input Grid Studio and start the camera. Keep both shoulders visible during calibration.
2. Add an input. On Windows, **Add/Edit** opens its drawing editor; Linux uses the sidebar.
3. Choose the tracked body part, such as a wrist, and draw its regions on the grid.
4. Set the input name, action and optional keyboard binding.
5. Save the profile as JSON. On Windows, apply the input to the document before **File → Save**.
6. Stop the camera, open the Motion Input Grid Controller and import the saved profile.

Region colors describe their conditions:

| Color | Condition |
| --- | --- |
| 🟩 Green - Required | Visit this region; numbered regions specify the route's order. |
| 🟥 Red - Forbidden | Avoid this region. |
| 🟨 Yellow - Trigger | Complete the movement here to emit its action. |
| 🟪 Purple - Interaction | Perform the selected hand sign in this region, optionally holding it. |

<details>
<summary>Detailed region editing controls</summary>

Click a movement to open its tracked point and zones. Changing the tracked point
immediately reassigns its existing zones in the document; a collision with another
tracked point is rejected without losing either drawing. **Movement settings**
opens identity and output settings; **Back to zones** returns to drawing.
Hand-sign settings appear only after placing or selecting a purple conditional
trigger. Changes update that trigger immediately. Clicking a cell with the current
brush colour selects it; another colour asks before replacing its zone.
Windows keeps Ctrl+Z/Y available without toolbar buttons. Recording and the
separate body-parts menu are no longer presented. **File → Save** writes the JSON
file; editing never silently overwrites an imported file. Linux also provides
an in-app **Complete JSON profile** page for all schema fields.
The [Windows controls](../getting-started/windows.md#workspace-and-drawing) and
[Linux controls](../getting-started/linux.md) describe the available tools.

</details>

## Check and use the profile

Use **Select** and drag with the left button held to select a rectangle on the
current layer. Hold **Ctrl** to retain the previous selection. Press **Delete**
to remove the selected regions and their linked tolerances. On Linux, use the
full-grid view for selection. Both native frontends use the web's six tools:
Select, Required, Trigger, Forbidden, Interaction and Erase. Place cells directly;
tolerance authoring and priority controls have been removed. Imported margin
rules remain supported. Steps are successive phases, whereas route mode controls
the cells inside a phase (in order, any order or simultaneous).

<details>
<summary>Advanced: finger and sign conditions</summary>

Changing inspector sections preserves the input's conditions. Removing a purple region
removes its own sign and finger rules, but independent whole-input and step
finger rules still apply. The binding summary shows these rules. Use
**Clear fingers** on Windows or **Clear all finger rules** on Linux to remove
finger conditions across all scopes;
this leaves the regions and purple hand signs in place. On Windows, the Fingers
scope selector also shows each scope's rule count. After editing, apply
the input again before testing and save the document to persist it.

</details>

Keep your shoulders visible so the grid can follow your body. Try the movement
and watch for action feedback. Use the [hand tracking guide](hands.md) for signs
and finger conditions. Close one application's camera before opening the other's.

Keyboard output starts disabled. The Motion Input Grid Controller guide explains how to enable it
and use Single press, Hold and Repeat. **View** controls the theme, preview overlays
and logs. The [configuration reference](../reference/configuration.md) describes
all saved fields and action modes.

> [!TIP]
> **Apply, save, then reimport** after a change.
> Stop Studio's camera before starting it in Controller.

## Build from source

After building from source:

| Method | File relative to the repository root |
| --- | --- |
| Windows `release` preset | `build/release/bin/motion-input-grid-studio.exe` |
| Default `tools/build/build-windows.ps1` script | `build/windows/bin/motion-input-grid-studio.exe` |
| Linux guide's build | `build/linux-apps/bin/motion-input-grid-studio` |

Follow the [Windows](../getting-started/windows.md) or
[Linux](../getting-started/linux.md) guide to build. The Linux guide also supplies
`--runtime` to locate models and the MediaPipe library. The `sdk-*` presets and
library packages do not build these applications.
