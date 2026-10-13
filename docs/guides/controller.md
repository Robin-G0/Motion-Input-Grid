# MIG Input

MIG Input runs profiles from MIG Studio or [MIG Studio Web](studio-web.md).
Its executable remains `mig-controller` for compatibility with existing scripts.
Open **Manage profile** for import, export and rename; session controls and live
movement feedback remain visible while you run a profile.

[English](controller.md) | [Français](controller.fr.md)

<details>
<summary>On this page</summary>

- [Find and launch the application](#find-and-launch-the-application)
- [First run](#first-run)
- [Profiles](#profiles)
- [Views](#views)
- [Verify a binding](#verify-a-binding)
- [If a movement does not work](#if-a-movement-does-not-work)
- [Build and troubleshooting](#build-and-troubleshooting)

</details>

The MIG Input runs profiles created in the MIG Studio while you use another
application or play a game. It provides profile selection, binding feedback and
optional camera verification. Use the [MIG Studio](configurator.md) to draw or change movements.

## Find and launch the application

> [!NOTE]
> On Debian, the MIG Studio, MIG Input and some native examples are still
> being developed and tested. They may not yet work fully.

In [Releases](https://github.com/Robin-G0/Motion-Input-Grid/releases), choose a matching native
archive when available:

| System | Archive | File after extraction |
| --- | --- | --- |
| Windows x64 | `motion-input-grid-<version>-windows-x64-native.zip` | `windows/mig-controller.exe` |
| Linux x64 | `motion-input-grid-<version>-linux-x64-native.tar.gz` | `./mig-controller` |

Paths start at the extracted archive's main folder. On Windows, open the executable.
On Linux, open a terminal in that folder and run `./mig-controller`; this launcher
sets up the bundled libraries before starting the binary in `bin/`. Keep the
archive's DLLs, models, configurations and other resources together. Windows
requires the Visual C++ 2022 x64 runtime; Linux archives require glibc 2.35+.

## First run

1. Close the MIG Studio's camera, then open `mig-controller`.
2. Open **Manage profile**, then **Import profile** (Windows) or **Import…** (Linux),
   and choose a JSON file saved by MIG Studio or MIG Studio Web.
3. Give the profile a recognizable name. On Windows, edit the name field and click
   **Save name**. On Linux, click **Rename profile**.
4. Click **Start**, face the camera and keep your shoulders visible for calibration.
5. Try a movement: its binding flashes green for 900 ms. Hold and Repeat bindings
   remain highlighted while their terminal conditions are satisfied.
6. Enable **Keyboard output** when ready, then focus your game or target application.

Keyboard output starts disabled every time you launch the MIG Input. Highlighting
works with output disabled. Windows uses SendInput; Linux requires X11/XTest and
keys available in the current keyboard layout. Native Wayland output is unavailable.
Stop, lost tracking, expired observations and closing the MIG Input release held keys.

## Profiles

The profile dropdown switches between imported profiles, including while tracking
is running. Switching releases keys and clears recognition from the previous
profile. Windows keeps capture running; Linux restarts its owning capture worker.
The new profile calibrates before producing actions. The last selected profile
and its name are restored on the next launch; camera and keyboard output still
require explicit activation.

Imported files are copied into your application-data folder. Moving the original
file does not break an imported profile. **Export file** saves the selected profile
as a normal JSON file that you can open in the MIG Studio or use with the libraries.
To use an edited configuration, import that file again as a new profile.
Invalid imports preserve the running profile. Up to 64 profiles can be stored.

Profile data is stored here:

- Windows: `%LOCALAPPDATA%\MIG\controller`.
- Linux: `$XDG_DATA_HOME/mig/controller`, or
  `~/.local/share/mig/controller` when `XDG_DATA_HOME` is unset.

`profiles.json` stores names and the last selection; numbered JSON files contain
standard schema-v2 configurations. Back up the whole folder to keep your profiles.
This list is separate from the [configuration format](../reference/configuration.md).

## Views

The default view displays bindings without a camera preview. This keeps feedback
available while avoiding preview conversion and rendering work.

In **View**, enable **Camera preview** to display both bindings and the mirrored
camera image. **Grid**, **Hand detections** and **Body dots** toggle overlays
independently. Hiding a hand overlay does not disable hand recognition required by
the profile. Light and dark themes are available through **Dark mode**.
Scrollbars in lists, dropdowns and log panes follow the selected theme on both
Windows and Linux, in the MIG Input and MIG Studio.

**Compact background window** reduces the MIG Input to a small window with an
**Open** button. Tracking and enabled keyboard output continue. **Open** restores
the previous window. Normal taskbar minimization also keeps tracking active.
Preview copying/conversion and painting are skipped while the preview is hidden.
The pose model still processes camera frames; hiding the UI does not reduce the
recognition quality or disable required hands.

## Verify a binding

Enable **View → Verify bindings**, then select a binding in the list. Its colored
regions appear over the camera: green Required, red Forbidden, yellow Trigger and
purple Interaction. White outlines indicate validated, triggered or currently held
regions. Invalid finger/sign conditions or missing landmarks use red feedback.
Order numbers appear in the regions; mirroring follows the recognized candidate.

Verification pauses all keyboard output while keeping recognition feedback live.
Turn verification off before playing. You can recalibrate without modifying the
profile. Verification does not edit regions or isolate recognition to one input;
all bindings continue to report their accepted actions.

## If a movement does not work

| What you see | What to check |
| --- | --- |
| Calibration does not finish | Keep both shoulders visible and recalibrate. |
| The binding does not light up | Enable **Camera preview** and **Verify bindings** to see regions and missing conditions. |
| The binding lights up but no key is sent | Check its keyboard binding, enable **Keyboard output**, turn verification off and focus the target application. |
| The action does not fire a second time | Leave the final region, then repeat the route; also check the profile's cooldown. |
| A hand sign is missing | Check hand support and visibility; see the [hand guide](hands.md). |

> [!NOTE]
> **Verify bindings** pauses all keyboard output. Examples and libraries report
> logical events; the MIG Input sends keys when you enable that option.

## Build and troubleshooting

After building from source:

| Method | File relative to the repository root |
| --- | --- |
| Windows `release` preset | `build/release/bin/mig-controller.exe` |
| Default `tools/build/build-windows.ps1` script | `build/windows/bin/mig-controller.exe` |
| Linux guide's build | `build/linux-apps/bin/mig-controller` |

Follow the [Windows](../getting-started/windows.md) or
[Linux](../getting-started/linux.md) guide to build. The Linux guide also supplies
`--runtime` to locate models and the MediaPipe library. The `sdk-*` presets and
library packages do not build these applications.

See [Windows applications](../getting-started/windows.md) or [Linux applications](../getting-started/linux.md)
for dependencies and build commands. Keep the runtime libraries and models beside
the packaged executable. A profile with hand tracking requires a hands-enabled build.
If a saved profile is missing or invalid, the MIG Input reports the problem;
import a valid file or select another saved profile.

The MIG Input uses the same recognition engine and key scheduler as the
MIG Studio. Automated tests cover profile persistence, view changes, verification
and cancellation. Camera accuracy and delivery to a particular game require a
check on your desktop.
