Control browser presentations with deliberate hand movements.

MIG Controller turns your webcam into a presentation remote. Select the target tab, allow camera access and follow the illustrated gestures to move forward or backward. The desktop MIG Controller is not required.

Features
• Two animated preset movements for next and previous.
• Normal and Reversed presets with editable key assignments: click Change and press the key you want.
• Manual mode to start and stop the camera yourself.
• Explicitly armed automatic mode that follows the detected presentation state in the selected tab.
• A grey square when the camera is stopped and a red circle while it is running.
• MIG schema-v2 JSON profile imports, with movement names and assigned keys shown in the controls.
• English and French interface.

Your camera images stay on your device
Video processing and movement recognition run locally. The extension does not record video, upload camera images or body positions, or send telemetry. Settings and profiles are kept in local browser storage. The tab URL/title and presentation state are used locally to target commands.

Presentation sites
Site detection covers Canva, Gamma, Google Slides and PowerPoint web. Actual operation depends on the player accepting simulated page key events. A user test confirmed presentation control with Opera + Canva; not every browser/service combination has been manually verified. Other accessible web pages can use generic arrow controls in manual mode.

Get started
1. Open your presentation and click MIG Controller.
2. Check the target tab and select a preset.
3. Start in manual mode and allow the camera.
4. Face the camera with both shoulders visible, follow the illustrated movements and return to rest between gestures.
5. Stop or close the controller window to release the camera.

Experimental first release
Test before an important presentation. Recognition may take a few seconds to resume after you leave the camera view; show both shoulders and use Recalibrate if needed. Desktop applications and built-in PDF viewers are not supported. Page key events are synthetic, not hardware input, and some players may ignore them.

Windows/Command and Alt shortcuts, text macros and Hold/Repeat profiles are rejected. Use Once mode for custom profiles. Navigation targets the selected tab; commands are ignored in recognized text fields or while the page is hidden.

A webcam is required. There is no MIG account, payment or subscription requirement. Presentation providers may require their own accounts. MIG Controller is independent and is not affiliated with the named services.

Support: robin.g0.dev@gmail.com
Source and issues: https://github.com/Robin-G0/Motion-Input-Grid/issues
