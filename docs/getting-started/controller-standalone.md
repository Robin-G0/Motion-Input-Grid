# Standalone Controller

[English](controller-standalone.md) | [Français](controller-standalone.fr.md)

Controller-only packages are one Windows x64 `.exe` and one Linux x64 `.run`.
They include runtime, models, dependencies and legal notices, with no desktop
Studio, SDKs or examples. Check the official release catalogue for available downloads.

> [!TIP]
> **Coming from Studio Web?** The [Controller guide](../guides/controller.md) walks
> through import and your first test. **No Python or compiler installation needed.**

## Use a published file

Download from the [official release](https://github.com/Robin-G0/Motion-Input-Grid/releases/latest).
Run the `.exe`. On Linux, allow execution in the file properties or run
`sh filename.run`. Import the JSON exported by web Studio, review the bindings,
start tracking with keyboard output off, then enable output and focus your
application. See the [Controller guide](../guides/controller.md).

> [!IMPORTANT]
> **Import → start with output off → check the movement → enable output → click
> inside the target application.** Close Studio's camera first.

Windows extracts the embedded runtime once under
`%LOCALAPPDATA%\MotionInputGrid\runtime\<payload-sha256>\`. Every launch validates
all files and the completion marker before reuse. It does not normally use
`%TEMP%`. Linux still extracts into a fresh temporary directory per launch and
removes it on normal exit. A forced termination can leave temporary files.
No installation, admin rights, Python or development toolchain is needed.
The launcher never downloads models or dependencies. Licenses remain included.

<details>
<summary>Technical details: Windows cache validation</summary>

Windows extraction is staged next to the cache and published by a same-volume
rename only after file flushing and validation. A per-payload file lock prevents
concurrent partial publication. An interrupted staging folder is never accepted
as a completed runtime. Corrupted/incomplete caches are quarantined and rebuilt;
old versions, `.invalid-*` and `.staging-*` folders are not automatically removed.
Close all Controller instances before removing obsolete folders manually.

The marker alone is insufficient: expected sizes and SHA-256 hashes for every
file are compiled into the EXE, including the cached manifest and license files.
Unexpected entries, reparse points and hard links are rejected. Validated files
remain locked against writes/deletes while the Controller runs. This protects
cache integrity; it is not a security boundary against an attacker who already
controls the same Windows account or can replace the downloaded EXE.

</details>

Windows includes app-local Visual C++ runtime DLLs; the launcher uses a static
CRT. OS camera/display facilities remain required. Linux bundles Qt plugins,
fonts and non-system libraries, and requires glibc 2.35+, camera access and a
display session. Keyboard output requires X11/XTest, not Wayland. The temporary
directory must permit execution; use `TMPDIR` to select another user directory.

SmartScreen can warn about unsigned files. Verify the official source. If you
choose to trust it, **More info** and **Run anyway** may be offered. Do not disable
Windows protection. Signing and reputation are separate from bundling.

## Build and validate

`tools/packaging/package-windows-release.ps1` also builds the standalone file
using the Visual Studio app-local redistributable CRT. For a prepared directory:

```powershell
python tools/packaging/package-controller.py --platform windows --source distribution/windows --redist "C:/path/to/Microsoft.VC143.CRT"
```

`tools/packaging/package-linux.py --native` also creates the Linux file. To
repackage an extracted dependency-complete native bundle:

```sh
python3 tools/packaging/package-controller.py --platform linux --source /path/to/extracted-native-bundle
python3 tests/packaging/controller_package_tests.py
python3 tests/packaging/controller_runtime_tests.py build/releases/motion-input-grid-1.3.0-controller-linux-x64.run
```

Outputs are versioned with SHA-256 sidecars. Candidate workflows test the bundle
and run built-in app diagnostics through its final file; native builds must use
`MIG_BUILD_TESTS=ON`. Test real camera input and keyboard delivery on the target
desktop before publication. Headless UI tests cannot verify those interactions.

The Windows runtime test also checks first-launch creation, reuse without
rewrites, corruption with forged manifest, incomplete cache, extra DLLs, marker
corruption, injected junctions and concurrent first launches. Its child process
PATH contains only Windows folders. It records the actual loaded DLLs and rejects
modules outside the validated cache and Windows. See the
[Windows dependency inventory](../reference/windows-runtime-dependencies.md).

## First Windows launch and cleanup

When the cache is missing or fails validation, a small window explains the local runtime before extraction. Its read-only field shows the exact resolved `%LOCALAPPDATA%\MotionInputGrid\runtime\<payload-sha256>\` directory. **Copy path** copies it; **Continue** prepares and starts the Controller. Closing this window cancels installation. A valid cached runtime starts directly, with no repeated notice. Deleting the runtime or detecting corruption brings the notice back before rebuilding. Close MIG before deleting runtime folders; profiles are stored separately and are not removed by runtime cleanup.

Cache validation, compiled hashes, atomic staging/publication and held file locks remain unchanged. No extra dismissal marker can make an incomplete installation valid. Exact diagnostic-only invocations (`--help`, `--ui-test`, `--infer-test`, `--hands-test`, `--session-test`) skip onboarding so unattended checks remain possible. Normal application launches show it when installation is needed.

```powershell
python tests/packaging/runtime_notice_tests.py build/releases/motion-input-grid-1.3.0-controller-windows-x64.exe
```

This test opens real windows with an isolated profile library and verifies cancellation, the read-only resolved path, Copy path, first installation, silent reuse without rewrites and reinstallation after an incomplete cache. Diagnostic builds alone support `MIG_TEST_PROFILE_DIRECTORY` to isolate interactive tests and screenshot capture; ordinary builds use the normal profile library.
