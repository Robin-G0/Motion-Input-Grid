# Changelog

[English](CHANGELOG.md) | [Français](CHANGELOG.fr.md)

## Unreleased

- MIG Studio and MIG Input adopt the website's light/dark palette and clearer
  session, movement and zone controls on Windows and Linux. Advanced precision
  and native keyboard consent remain available; executable names stay compatible.
- MIG Studio Web is documented as a browser alternative sharing JSON profiles.

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

## 1.0.0 — first public release

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
