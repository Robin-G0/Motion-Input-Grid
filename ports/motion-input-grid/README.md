# Motion Input Grid (MIG) vcpkg port

[English](README.md) | [Français](README.fr.md)

[**Download the ready-to-install overlay**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-vcpkg-overlay) - extract before `vcpkg install`. Building it below is optional.

This directory is the port for MIG itself. The root `vcpkg.json` is the separate
dependency manifest used to build MIG.

**Install the extracted overlay:**

```sh
vcpkg install motion-input-grid --overlay-ports=/path/to/motion-input-grid-vcpkg-overlay
```

**Generate your own overlay from the full checkout:**

```sh
python tools/packaging/package-source.py
```

The engine source and overlay archives are written to `build/releases`.
Generated `motion-input-grid/source.cmake` pins the release URL and the source
archive's actual SHA512.

> [!NOTE]
> The tracked template intentionally fails until that pin is generated.
> For direct installation, use **the release overlay**, rather than the template.

Default features provide JSON profiles and hands. `motion-input-grid[c-api]` adds the shared
C ABI and requires a dynamic triplet. Applications and MediaPipe are excluded.
Consumers use `find_package(MIG CONFIG REQUIRED)` and `MIG::core`, `MIG::format`,
`MIG::hands` or `MIG::c`. Use the same compiler/toolset for the SDK and consumer.

Before uploading the source archive, the artifact test seeds vcpkg's download
cache with the generated file and still validates the pinned hash. After manual
upload, test the public release URL without that cache. Publishing a registry port
or submitting to upstream vcpkg remains manual.

[Distribution guide](../../docs/getting-started/packages.md).
