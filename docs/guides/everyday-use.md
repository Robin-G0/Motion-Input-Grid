# Everyday computer use

[English](everyday-use.md) | [Français](everyday-use.fr.md)

**Download Studio + Controller:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Use one deliberate movement to run a familiar shortcut in the foreground
application. Start in a disposable document, with an action that is easy to undo.

> [!TIP]
> **First goal: copy sample text.** Choose **Once** and a yellow region your
> ordinary movements do not reach.

## Create, test and use

1. Create a movement in [Studio Web](studio-web.md) or
   [desktop Studio](configurator.md). Name it **Copy selection**, with logical
   action `copy_selection`. Draw 🟩 **Required** at the wrist's resting position
   and 🟨 **Trigger** somewhere your normal typing does not reach.
2. In web Studio, choose **Assign keys**, add a shortcut and capture **Ctrl+C**,
   or add **Ctrl** and **C** to the same row. Keep **Once**, then **Save and return
   to movements**. In desktop Studio, use the movement settings and **Single press**.
   Test the configuration, then export it. No JSON editing is needed.
3. Stop the editor camera and import JSON in the [Controller](controller.md).
   Start tracking, calibrate, and confirm the intended movement with output off.
4. Enable output. In a text editor, select some sample text and perform the
   movement. Paste manually to check that the intended text was copied.
5. Return your hand to rest before trying again. Disable output or stop tracking
   when you leave the target application.

> [!WARNING]
> Shortcuts go to the **foreground application**. Check its bindings before reusing
> a profile. Avoid destructive commands, passwords or irreversible actions while learning.

## If tracking feels unreliable

If recognition feels unreliable, reposition the drawn regions using the camera
and recalibrate after moving your chair or camera. You can edit and export a
profile even when camera permission is unavailable.

This desktop workflow supports Windows and Linux x64. Linux keyboard output
requires X11/XTest; native Wayland output is unavailable. The browser Studio only
shows action feedback and cannot control other applications.
