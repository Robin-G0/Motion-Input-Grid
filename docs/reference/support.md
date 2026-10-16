# Support and maturity

[English](support.md) | [Français](support.fr.md)

This is the canonical support matrix for MIG 1.1.0, JSON schema 2 and C ABI 1.
A maturity label describes the interface, not the quality of a particular camera.
Automated synthetic and blank-frame checks cannot establish hardware compatibility.

On Debian, the Motion Input Grid Studio, Motion Input Grid Controller and some native examples are still being
developed and tested and may not yet work fully. The checks below cover only the
stated test cases. The Debian `.deb` package supplies the SDK and C ABI, not these
desktop applications.

| Component | Maturity | Evidence | Targets | Scope / limit |
| --- | --- | --- | --- | --- |
| Core / C++ SDK | Stable | Tested | Windows x64, Linux x64/ARM64 | CTest, installed CMake consumer; ARM64 emulated |
| C ABI 1 / schema 2 | Stable | Tested | Same SDK targets | Packet layout, strict imports, recognition and lifecycle fixtures |
| Python ctypes | Beta | Tested | Windows x64, Linux x64/ARM64 | Installed self-contained wheels; Linux glibc 2.35+ |
| JavaScript / WASM | Beta | Tested | Modern desktop browsers | npm installation, native WASM and synthetic browser/lifecycle tests |
| .NET binding | Beta | Tested | Windows/Linux x64 | Managed bridge against extracted C ABI; engine editor tests are separate |
| vcpkg | Beta | Tested | Windows/Linux x64 | Generated overlay installation and external consumer |
| Debian / APT tooling | Beta | Tested | amd64; arm64 package generated | amd64 installation; signed test repository update/download |
| Native capture / desktop apps | Beta | Tested | Windows/Linux x64 | Blank-frame and synthetic/UI tests; real camera/key delivery untested |
| Godot add-on | Preview | Tested | Godot 4.3, Windows x64, Linux x64/ARM64 | Fresh-project imports and GDScript lifecycle; no exported-game validation |
| Unity UPM | Preview | Untested in editor | Windows/Linux x64 | Native/.NET payload tested; editor/player builds not run |
| Unreal plugin | Preview | Untested in editor | Windows x64, Linux x64/ARM64 payloads | C ABI payload tested; module/game builds not run |
| Face scaffold | Experimental | Untested | Portable source | No face estimator or supported face recognition product |
| Real cameras, OS key delivery, physical ARM64 | - | Untested | Target-dependent | Hardware/manual tests required |
| macOS, mobile engine plugins | Planned | Untested | No distributed binaries | No support claim |

## Labels

- **Stable**: public contracts exercised by regression and installed-consumer tests;
  changes follow the documented API/ABI/schema contract.
- **Beta**: usable interface with automated validation and remaining deployment checks.
- **Preview**: integration for evaluation; editor versions, exports and installation
  need broader manual validation before stabilization.
- **Experimental**: incomplete or exploratory functionality without a support guarantee.
- **Tested**: the stated check actually ran; it covers only its stated environment.
- **Untested**: the relevant check has not run.
- **Expected to work**: an inference from compatible prerequisites, never test evidence.
- **Planned**: no delivered support. Roadmap entries are not commitments.

Windows native binaries need a compatible Visual C++ runtime. Linux targets glibc
2.35+; native Linux keyboard output uses X11/XTest, not Wayland injection. The
pinned MediaPipe estimator is supplied for x64. ARM64 SDKs accept host landmarks;
there is no Linux ARM64 camera runtime or Windows ARM64 binary in this release.
Editor packages do not include a camera provider.

See [quick start](../getting-started/bootstrap.md), [architecture](../architecture/overview.md)
and [package contents](../getting-started/packages.md). Hardware validation should
cover integrated/USB webcams, resolutions and frame rates, CPUs/GPUs, camera
start/stop, missing/stale frames and held-key release on each target system.
