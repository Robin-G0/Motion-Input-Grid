# Windows Controller runtime dependencies

[English](windows-runtime-dependencies.md) | [Français](windows-runtime-dependencies.fr.md)

> [!NOTE]
> **Running the Controller does not require Visual Studio.** The single-file bundle includes its application DLLs.
> Windows Media Foundation, device drivers and camera permissions remain required.

The Windows single-file Controller embeds its complete application runtime and
licenses. A developer Visual Studio installation is not a runtime dependency.
See [cache architecture and usage](../getting-started/controller-standalone.md).

## Application DLL closure

For the checked v1.1.0 Controller and MediaPipe binaries, every required non-OS
DLL is embedded and validated in the hash-addressed runtime directory:

| File | Purpose |
| --- | --- |
| `motion-input-grid-controller.exe` | Native Controller |
| `libmediapipe.dll` | Explicitly loaded native pose/hand inference runtime |
| `msvcp140.dll` | C++ standard library |
| `msvcp140_atomic_wait.dll` | C++ atomic wait support |
| `vcruntime140.dll` | Microsoft C/C++ runtime |
| `vcruntime140_1.dll` | Additional x64 C++ runtime support |

The complete app-local CRT directory is retained. It also ships `concrt140.dll`,
`msvcp140_1.dll`, `msvcp140_2.dll`, `msvcp140_codecvt_ids.dll`, `vccorlib140.dll`
and `vcruntime140_threads.dll`; these six are not required by the checked
Controller/MediaPipe import closure. All shipped files are hashed, regardless
of whether a particular run loads them. `mig-c.dll` is not required or included.

The Controller's direct OS imports are `comctl32.dll`, `comdlg32.dll`,
`dwmapi.dll`, `gdi32.dll`, `kernel32.dll`, `mf.dll`, `mfplat.dll`,
`mfreadwrite.dll`, `ole32.dll`, `shell32.dll`, `user32.dll`, `uxtheme.dll`
and Windows Universal CRT API-set contracts. MediaPipe directly imports
`advapi32.dll`, `dbghelp.dll`, `kernel32.dll` and `wininet.dll`. `dbghelp.dll`
is a Windows component; its presence does not require developer tools.

These OS components, Windows API-set implementations, Media Foundation,
camera/display drivers and device permissions remain platform requirements.
Use supported Windows x64 with Media Foundation available. Windows N editions
may need their OS media feature enabled; shipping DLLs does not replace that
Windows feature or a camera driver.

## Complete machine-readable inventory

`tools/lib/pe_dependencies.py` parses normal imports, delay imports and forwarded
exports. Packaging seeds every bundled EXE/DLL, so explicitly loaded MediaPipe
is audited even though it is absent from the Controller's static import table.
The audit recursively follows imports into bundled files or Windows System32
and records API-set contracts. It never searches developer PATH directories.
Missing application libraries fail the package, even if a developer CRT happens
to be installed in System32. Only allowlisted Windows components can satisfy
direct application OS imports.

The package generates:

- `<controller.exe>.dependencies.json`: payload and static-CRT launcher graphs,
  with module hashes, all import edges and unresolved optional Windows delay loads.
- `windows-dll-dependencies.json` in the extracted runtime: the embedded payload
  dependency graph, also protected by the launcher's compiled hashes.
- `<controller.exe>.observed-modules.json` after runtime tests: modules actually
  observed in the Controller child during UI and pose/hand inference diagnostics.

The observed build host's payload graph contains 286 System32 modules and 730
API-set contracts. These are the host's transitive normal/delay/forwarder graph,
not 286 libraries the user must install or files we copy from Windows. Counts
and OS module hashes vary by Windows release. Optional Windows-owned delay loads
absent on the host are reported explicitly, not treated as bundled dependencies.

## Verification and limits

```powershell
python tests/packaging/controller_package_tests.py
python tests/packaging/pe_dependency_tests.py
python tests/packaging/controller_runtime_tests.py build/releases/motion-input-grid-1.1.0-controller-windows-x64.exe
```

The final EXE runs from a folder containing only that file. Runtime tests restrict
the child PATH to Windows folders, verify cache creation/reuse/repair and observe
loaded modules. On the checked host, 76 observed modules came only from the
validated cache or Windows, including native MediaPipe inference. No modules
from a developer directory were accepted. The launcher is audited separately;
its `/MT` CRT is static and its remaining imports are Windows components.

Static PE analysis cannot enumerate arbitrary plugins/drivers selected by Windows
when a real camera is opened. Runtime observation samples the diagnostics rather
than every possible device path. A pristine Windows VM was not available for
this validation. Keep clean-target Windows camera/keyboard testing as a release
acceptance check; do not equate a sanitized-PATH test with a fresh OS installation.
