# Presentation controls

[English](presentations.md) | [Français](presentations.fr.md)

**Download Studio + Controller:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Use a deliberate wrist movement to advance **Canva, PowerPoint, PDF and other
presentation / slideshow formats**, through the keyboard shortcuts of the viewer.
**No code or JSON editing needed.** Keep your keyboard available as a backup.

> [!TIP]
> **Check the shortcut with your physical keyboard first.** Open the presentation
> in presenting or full-screen mode, click inside it and press **Right arrow**.
> If it does not advance, use the viewer's actual next-page shortcut in MIG.
> Shortcuts depend on the application, browser and viewing mode.

## Draw and test one gesture

1. Open [Studio Web](https://robin-g0.github.io/Motion-Input-Grid/studio/) or the
   [desktop Studio](configurator.md). Create a movement named **Next slide**,
   with action `next_slide`, tracking your preferred wrist.
2. Draw a 🟩 **Required** region around the wrist's resting position, then a
   🟨 **Trigger** region higher up. Use the camera to place them around your actual
   movement, keeping both shoulders visible. Avoid placing Trigger where you
   normally gesture while speaking. Return to rest between activations.

## Assign the presentation key

1. Choose **Assign keys** in web Studio. Add the shortcut you verified (**Right**
   if your keyboard test worked) and keep **Once**, then **Save and return to movements**.
2. Choose **Test the whole configuration**. Make your gesture and check the
   journal for the action and simulated key press.
3. Choose **Export** to save the profile. The reminder links to the Controller
   download and illustrated setup guide.

> [!NOTE]
> Studio Web **simulates** keys in the journal. The desktop **Controller** sends
> them to your presentation. Its download and setup links appear after export.

## Import and rehearse

1. **Stop the editor camera**. Open the [Controller](controller.md) and select the
   exported file with **Import profile**.
2. Review the imported movement and its key before confirming.

![Controller import review showing HI, Single press and the Right key](../../site/studio/controller/images/import.png)

*Real Windows example: this profile is named HI; yours should show Next slide
and your chosen key. Linux layout differs.*

3. Start tracking and calibrate in your presentation position. Keep **Keyboard
   output off** until only the intended gesture lights up its movement row.
4. Enable output, open **Canva, PowerPoint, a PDF viewer or another presentation /
   slideshow application**, start presenting and **click inside the presentation**.
5. Make one gesture. Check that exactly the expected animation, slide or page advances.

> [!WARNING]
> Keys go to the **foreground application**. Rehearse on a copy before presenting
> live. **Disable output during questions** or when ordinary gestures could trigger
> a movement. Keep your keyboard within reach.

## Previous slide and viewer differences

PowerPoint uses **Right arrow** for the next animation or slide and **Left arrow**
for the previous animation or slide. A slide with builds may therefore need
several activations. See Microsoft's
[slide-show keyboard shortcuts](https://support.microsoft.com/en-us/office/use-keyboard-shortcuts-to-deliver-powerpoint-presentations-1524ffce-bd2a-45f4-9a7f-f18b992b93a0).
For another presentation application, check its shortcuts first.

Add a separate **Previous slide** movement with **Left** if
needed. Keep the two routes distinct and use Single press for both. Disable
output when ordinary gestures could activate a route.

| What happens? | Try this |
| --- | --- |
| No movement lights up | Keep both shoulders visible, recalibrate and check your regions. |
| The movement lights up but nothing advances | Check output is on, **Verify bindings** is off, and the presentation has focus. |
| Several slides advance | Use **Once** and return to rest between gestures. Also check the viewer's animations. |
