# Changelog

[English](CHANGELOG.md) | [Français](CHANGELOG.fr.md)

## Unreleased

- Add experimental MIG Controller browser extension packages with illustrated,
  rebindable presets, browser-only profile keys, manual/automatic camera lifecycle,
  grey/red toolbar icons and a separate extension CI category.
- Select CI checks from changed components, preserving shared dependency coverage,
  complete manual/release validation and the site deployment gate.
- Capture is an option when adding a movement to a profile, alongside manual drawing.
  Recording highlights visited cells, start and finish; subsequent takes display
  the last successful path and endpoints faintly as a guide.
- Studio can capture a selected body part across three five-second takes, merge
  an ordered route with three precision presets, test it and assign a key.
  Inconsistent takes are retried; cancellation releases the camera without
  changing the draft. Existing schema-v2 profiles remain the output format.
- Add illustrated, bilingual presentation steps for Canva, PowerPoint, PDF and other slideshows; improve reading paths, examples and technical references.
- Reject NUL in profile identifiers, names and actions to preserve native string contracts.
- Preserve an active recording when a replacement landmark selection is invalid.
- Validate documentation on every push and pull request, including documentation-only changes.
- Align bilingual architecture, camera SDK prerequisites and example walkthroughs with the implementation.

## 1.1.0

- Browser presentation and Studio for profile creation, import, annotations and live tests.
- Consistent Required / Forbidden / Trigger / Interaction tools and native application icons.
- Movable log terminal, contextual editing and window refresh fixes.
- Python wheels validate and normalize RECORD after auditwheel repair.
- TypeScript MIGCoordinate now declares its existing confidence field.
- Download catalogue organized by use, platform and integration.


- Rename application displays, web Studio and executable files to Motion Input Grid
  Studio / Controller (`motion-input-grid-studio`, `motion-input-grid-controller`).
- Studio uses one window for contextual editing and testing, without Basic/Advanced
  mode. Linux also edits step scope, route mode and simultaneous hold visually.

- Motion Input Grid Studio and Motion Input Grid Controller adopt the website's light/dark palette and clearer
  session, movement and zone controls on Windows and Linux. Advanced precision
  and native keyboard consent remain available.
- Motion Input Grid Studio Web is documented as a browser alternative sharing JSON profiles.

## 1.0.2

- Each native, browser and engine tutorial has its own standalone download, with
  source, launch instructions and required runtime files. Release tables separate
  examples by technology and platform; bulk example collections are not published.
- Build tools and tests are grouped by purpose. Bilingual guides describe package
  contents, installation and integration lifecycles, with links to latest downloads.
- Desktop profile imports show the complete keyboard mapping before acceptance and
  require separate keyboard activation. Keyboard definitions and automation sizes
  are validated consistently across the engine and profile parser.
- Raised-hand demos use broad Required and Trigger regions, with regression coverage
  for skipped observations and movement direction.
- Native example packages share frozen Python dependencies and avoid redundant SDK
  runtime copies. Parallel C++ example builds serialize shared asset staging.
- Example guides include launch instructions, integration walkthroughs and package
  installation instructions.

## 1.0.0 - first public release

Prototype and initial development took place privately before this first public release.

- C++20 recognition engine: shoulder-scaled grids, ordered Required/Forbidden/Trigger
  regions, mirrored anatomy, hand/finger Interaction conditions and hold durations.
- Strict JSON schema 2, calibrated coordinates and C ABI 1 with explicit lifecycle.
- Windows/Linux camera controller and configurator; opt-in Single/Hold/Repeat keys.
- Installed CMake SDK, vcpkg overlay, self-contained Python wheel/sdist, browser WASM
  package with React/Vue/Next.js adapters and Debian/signed APT tooling.
- Godot add-on, Unity UPM and Unreal Code Plugin packages, all **Preview**.
- Reproducible candidate builds, extracted-package tests, manifests and checksums.

See [support and validation limits](../reference/support.md) and the [roadmap](ROADMAP.md).
