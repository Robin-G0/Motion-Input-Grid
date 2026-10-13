# Documentation

[English](index.md) | [Français](index.fr.md)

Motion Input Grid (MIG) recognizes movements described in a JSON profile.
Use its desktop applications to control another application, or embed the same
engine in your own project. Choose a starting point below.

## Use the desktop applications

| I want to… | Guide |
| --- | --- |
| Create or test a profile in the browser | [Motion Input Grid Studio Web](guides/studio-web.md) |
| Draw a movement and assign a shortcut | [Motion Input Grid Studio](guides/configurator.md) |
| Run my profile while using another application | [Motion Input Grid Controller](guides/controller.md) |
| Try a camera demo without setting up a profile | [Standalone examples](../examples/README.md) |
| Add a hand sign or finger condition | [Hand tracking](guides/hands.md) |

**Download Studio + Controller:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications).
The guides above explain how to launch them. For tutorials, choose a download
from the [example catalogue](../examples/README.md).

## Choose a practical use

| Situation | Guide |
| --- | --- |
| PowerPoint and other slide shows | [Presentation controls](guides/presentations.md) |
| Existing games or your own game | [Video games and anti-cheat precautions](guides/video-games.md) |
| Shortcuts in desktop applications | [Everyday computer use](guides/everyday-use.md) |

## Build an application with MIG

| Technology | Installation and first action |
| --- | --- |
| C++ / CMake / Make | [SDK installation](getting-started/cpp.md), [C++ API](reference/cpp.md) |
| Python | [pip and frame submission](../bindings/python/README.md), [Tkinter](../examples/python-tkinter/README.md), [Pygame](../examples/pygame/README.md) |
| Browser / React / Vue / Next.js | [npm package](../bindings/javascript/README.md), [framework setup](integrations/javascript.md) |
| Godot / Unity / Unreal | [Godot add-on](../integrations/godot/README.md), [Unity UPM](../integrations/unity/README.md), [Unreal plugin](../integrations/unreal/README.md) |
| vcpkg / Debian | [Package installation](getting-started/packages.md) |

Start with [bootstrap](getting-started/bootstrap.md) to connect a profile,
tracking and action feedback. Then use the [example catalogue](../examples/README.md)
and [source walkthrough](getting-started/examples.md) to adapt a working host.
The [integration guide](integrations/overview.md) covers supplied landmarks and native camera adapters.

## Understand the contracts

| Subject | Reference |
| --- | --- |
| JSON fields, keyboard sequences, constraints and layers | [Configuration schema](reference/configuration.md) |
| Packets, handles and language binding lifecycle | [C ABI](reference/c-abi.md), [.NET bridge](../bindings/dotnet/README.md) |
| Modules, dependencies and repository structure | [Architecture](architecture/overview.md) |
| Calibration, coordinate spaces and movement matching | [Recognition](architecture/recognition.md) |
| Workers, capture and shutdown | [Execution pipeline](architecture/lifecycle.md) |
| Real-time work, measurement and limits | [Performance](architecture/performance.md) |
| Supported platforms and test coverage | [Support matrix](reference/support.md) |

## Build and contribute

[Windows build](getting-started/windows.md) · [Linux build](getting-started/linux.md) ·
[Contributing](../CONTRIBUTING.md) · [Package installation](getting-started/packages.md) ·
[Changelog](development/CHANGELOG.md) · [Roadmap](development/ROADMAP.md)

Each guide has an English/French link at the top. API names, JSON fields and
upstream legal notices retain their original spelling.
