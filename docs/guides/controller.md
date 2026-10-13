# Motion Input Grid Controller

Motion Input Grid Controller runs profiles from Motion Input Grid Studio or [Motion Input Grid Studio Web](studio-web.md).
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

The Motion Input Grid Controller runs profiles created in the Motion Input Grid Studio while you use another
application or play a game. It provides profile selection, binding feedback and
optional camera verification. Use the [Motion Input Grid Studio](configurator.md) to draw or change movements.

## Find and launch the application

> [!NOTE]
> On Debian, the Motion Input Grid Studio, Motion Input Grid Controller and some native examples are still
> being developed and tested. They may not yet work fully.

Download for your system. The same package includes Studio and Controller:

| System | Download v1.1.0 | Open after extraction |
| --- | --- | --- |
| Windows x64 | [Download ZIP](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) | `windows/motion-input-grid-controller.exe` |
| Linux x64 | [Download tar.gz](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) | `./motion-input-grid-controller` |

Paths start at the extracted archive's main folder. On Windows, open the executable.
On Linux, open a terminal in that folder and run `./motion-input-grid-controller`; this launcher
sets up the bundled libraries before starting the binary in `bin/`. Keep the
archive's DLLs, models, configurations and other resources together. Windows
requires the [latest Visual C++ x64 runtime](https://aka.ms/vc14/vc_redist.x64.exe); Linux archives require glibc 2.35+.

## First run

1. Close the Motion Input Grid Studio's camera, then open the Controller listed in the download table above.
2. Open **Manage profile**, then **Import profile** (Windows) or **Import…** (Linux),
   and choose a JSON file saved by Motion Input Grid Studio or Motion Input Grid Studio Web.
3. Give the profile a recognizable name. On Windows, edit the name field and click
   **Save name**. On Linux, click **Rename profile**.
4. Click **Start**, face the camera and keep your shoulders visible for calibration.
5. Try a movement: its binding flashes green for 900 ms. Hold and Repeat bindings
   remain highlighted while their terminal conditions are satisfied.
6. Enable **Keyboard output** when ready, then focus your game or target application.

Keyboard output starts disabled every time you launch the Motion Input Grid Controller. Highlighting
works with output disabled. Windows uses SendInput; Linux requires X11/XTest and
keys available in the current keyboard layout. Native Wayland output is unavailable.
Stop, lost tracking, expired observations and closing the Motion Input Grid Controller release held keys.

## Profiles

The profile dropdown switches between imported profiles, including while tracking
is running. Switching releases keys and clears recognition from the previous
profile. Windows keeps capture running; Linux restarts its owning capture worker.
The new profile calibrates before producing actions. The last selected profile
and its name are restored on the next launch; camera and keyboard output still
require explicit activation.

Imported files are copied into your application-data folder. Moving the original
file does not break an imported profile. **Export file** saves the selected profile
as a normal JSON file that you can open in the Motion Input Grid Studio or use with the libraries.
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
Windows and Linux, in the Motion Input Grid Controller and Motion Input Grid Studio.

**Compact background window** reduces the Motion Input Grid Controller to a small window with an
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
> logical events; the Motion Input Grid Controller sends keys when you enable that option.

## Build and troubleshooting

After building from source:

| Method | File relative to the repository root |
| --- | --- |
| Windows `release` preset | `build/release/bin/motion-input-grid-controller.exe` |
| Default `tools/build/build-windows.ps1` script | `build/windows/bin/motion-input-grid-controller.exe` |
| Linux guide's build | `build/linux-apps/bin/motion-input-grid-controller` |

Follow the [Windows](../getting-started/windows.md) or
[Linux](../getting-started/linux.md) guide to build. The Linux guide also supplies
`--runtime` to locate models and the MediaPipe library. The `sdk-*` presets and
library packages do not build these applications.

See [Windows applications](../getting-started/windows.md) or [Linux applications](../getting-started/linux.md)
for dependencies and build commands. Keep the runtime libraries and models beside
the packaged executable. A profile with hand tracking requires a hands-enabled build.
If a saved profile is missing or invalid, the Motion Input Grid Controller reports the problem;
import a valid file or select another saved profile.

The Motion Input Grid Controller uses the same recognition engine and key scheduler as the
Motion Input Grid Studio. Automated tests cover profile persistence, view changes, verification
and cancellation. Camera accuracy and delivery to a particular game require a
check on your desktop.
