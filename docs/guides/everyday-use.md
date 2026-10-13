# Everyday computer use

[English](everyday-use.md) | [Français](everyday-use.fr.md)

Use one deliberate movement to run a familiar shortcut in the foreground
application. Start in a disposable document, with an action that is easy to undo.

1. Create a movement in [Studio Web](studio-web.md) or
   [desktop Studio](configurator.md). Name it **Copy selection**, with logical
   action `copy_selection`. Draw 🟩 **Required** at the wrist's resting position
   and 🟨 **Trigger** somewhere your normal typing does not reach.
2. In desktop Studio's movement settings, assign **Ctrl + C** and **Single press**.
   Alternatively, open Studio Web's **JSON** editor and add these fields to that
   existing movement inside `inputs`, preserving its other fields:

   ```json
   "keyboard": [{"keys": [17, 67]}],
   "action_mode": "single_press",
   "cooldown_ms": 700
   ```

   Apply and export the profile. See the
   [keyboard reference](../reference/configuration.md) for other shortcuts.
3. Stop the editor camera and import JSON in the [Controller](controller.md).
   Start tracking, calibrate, and confirm the intended movement with output off.
4. Enable output. In a text editor, select some sample text and perform the
   movement. Paste manually to check that the intended text was copied.
5. Return your hand to rest before trying again. Disable output or stop tracking
   when you leave the target application.

Shortcuts go to whichever application has focus; MIG does not choose the target
window for you. Check each application's bindings before reusing a profile.
Avoid destructive commands, passwords or irreversible actions while learning.
If recognition feels unreliable, reposition the drawn regions using the camera
and recalibrate after moving your chair or camera. You can edit and export a
profile even when camera permission is unavailable.

This desktop workflow supports Windows and Linux x64. Linux keyboard output
requires X11/XTest; native Wayland output is unavailable. The browser Studio only
shows action feedback and cannot control other applications.
