# Motion Input Grid Studio Web

[English](studio-web.md) | [Français](studio-web.fr.md)

[Open Motion Input Grid Studio Web](https://robin-g0.github.io/Motion-Input-Grid/studio/).
It is a static browser alternative to [Motion Input Grid Studio](configurator.md), with the
same JSON profile format and recognition engine.

1. Choose **Import JSON**, **New profile**, or the example. The home screen also
   offers your local draft when browser storage is available.
2. Choose a movement, then **Edit**. Select a tracked body part and draw required,
   🟩 **Required**, 🟥 **Forbidden**, 🟨 **Trigger** or 🟪 **Interaction** zones. Use the zone inspector for precise
   coordinates, fingers and timing; advanced movement settings stay separate.
3. Choose **Test**, allow the camera, and keep both shoulders visible. Choose
   action-only feedback or a log level. Triggered zones briefly light up.
4. For desktop shortcuts, add the movement's `keyboard` binding through **JSON**
   or open the exported profile in desktop Studio's movement settings. The
   [presentation guide](presentations.md) gives an example. Export JSON, then
   import it in [Motion Input Grid Controller](controller.md).

The mirrored grid matches the camera preview. Draw or erase notes in test mode;
they remain visible during editing and can be cleared separately from the profile.
Grid-only mode supports zoom and scrolling. Copy/paste keeps zones selected for
moving and resizing; Ctrl+A, Ctrl+Z and Ctrl+Y operate on the editor.

Camera images are processed locally; initial loading downloads the tracking
models and engine. The browser emits action events; it cannot send keyboard
shortcuts to other applications. The desktop Studio provides keyboard binding
controls and system key tests. Profiles can be exported even when camera access is unavailable.

Local drafts belong to one browser and one origin (scheme, hostname and port).
A different localhost port or another browser does not share them. Export JSON
for a durable copy or to move between machines. Clearing browser storage removes
local drafts; they are not synchronized to an account.
