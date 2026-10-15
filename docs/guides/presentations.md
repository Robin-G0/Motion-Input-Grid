# Presentation controls

[English](presentations.md) | [Français](presentations.fr.md)

**Download Studio + Controller:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Use Motion Input Grid Controller to send presentation shortcuts while you speak.
Start with one deliberate movement and keep your keyboard available as a backup.

1. Open [Studio Web](https://robin-g0.github.io/Motion-Input-Grid/studio/) or the
   [desktop Studio](configurator.md). Create a movement named **Next slide**,
   with action `next_slide`, tracking your preferred wrist.
2. Draw a 🟩 **Required** region around the wrist's resting position, then a
   🟨 **Trigger** region higher up. Use the camera to place them around your actual
   movement, keeping both shoulders visible. Avoid placing Trigger where you
   normally gesture while speaking. Return to rest between activations.
3. Choose **Assign keys** in web Studio. Add a key press, keep **Right** and
   the **Once** mode, then **Save and return to movements**. To test all movements,
   choose **Test the whole configuration**: the journal shows actions and simulated
   keyboard operations. Choose **Export**. The export reminder links to Controller
   downloads and the illustrated setup guide. No JSON editing is needed.
4. Stop the editor camera. Import the exported file in the
   [Controller](controller.md), start tracking and calibrate in your presentation
   position. Keep **Keyboard output** off until only the intended gesture lights
   up its movement row.
5. Enable output, focus PowerPoint and start its slide show. Rehearse on a copy
   of the presentation before using it live.

PowerPoint uses **Right arrow** for the next animation or slide and **Left arrow**
for the previous animation or slide. A slide with builds may therefore need
several activations. See Microsoft's
[slide-show keyboard shortcuts](https://support.microsoft.com/en-us/office/use-keyboard-shortcuts-to-deliver-powerpoint-presentations-1524ffce-bd2a-45f4-9a7f-f18b992b93a0).
For another presentation application, check its shortcuts first.

Add a separate **Previous slide** movement with **Left** if
needed. Keep the two routes distinct and use Single press for both. Disable
output during questions or whenever normal gestures could activate a route.
