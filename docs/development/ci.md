# Selective continuous integration

[English](ci.md) | [Français](ci.fr.md)

**Pushes and pull requests test the affected components.** A small change-detection
job still runs to select checks; unrelated build jobs appear as skipped.

| Changed area | Checks selected |
| --- | --- |
| `extensions/**` | Browser extension build, unit/WASM tests, installed Chromium/Firefox checks, lint and ZIP packaging |
| `site/**` | Site build, Node tests, Chromium and Firefox; Pages deployment on `main` after success |
| Markdown, `docs/**`, documentation checker | Documentation tests, translations and local links |
| `src/apps/**`, `src/controller/**`, `tests/apps/**` | Windows and Linux native builds, plus portable SDK tests that include shared app headers |
| `src/linux-apps/**` or platform UI tests | The corresponding native platform |
| Windows Controller packaging or Linux packaging tools | The corresponding native platform and package checks |
| Native camera adapter, Python binding and desktop Python examples | Windows and Linux native checks |
| JavaScript binding, framework examples, `src/web/**` | WASM producer followed by JavaScript consumers |
| Shared engine, CMake, configs, or an unrecognized code path | All source consumers: Windows, Linux native, portable SDK and WASM/JavaScript |

C++ file changes also select **clang-format**. Package version manifests select
the release metadata checks. Mixed changes combine the corresponding checks.
The site uses its **locked npm runtime**, so changing repository C++ sources
does not rebuild the site unless site files also change.

> [!NOTE]
> **Shared dependencies take priority over saving runners.** The native applications
> share headers and portable tests, so their checks cannot always be isolated to
> one executable. Unknown source paths run all source consumers to avoid silent gaps.

The detector is [ci-changes.py](../../tools/dev/ci-changes.py), called through
[changes.yml](../../.github/workflows/changes.yml). It compares the entire push
(`before` to `after`) or the PR's merge base to its head, using full Git history.
Renames include both old and new paths; there is no API file-count limit.
Each run shows its selected checks in the **job summary**.

> [!TIP]
> **Launch a workflow manually to run its complete validation.** First pushes with
> no baseline, or unavailable Git comparisons, also run all of that workflow's checks.
> Tagged releases build and validate **every release artifact**, including game-engine
> integrations and browser extensions. Engine packaging can also run manually.

The general CI exposes **Affected checks passed**, which fails if detection or
any selected build check fails or is cancelled. Skipped build jobs are accepted.
Documentation, site and extension workflows retain their own checks. Repository branch
protection settings are managed separately from these workflow files.

## Downloadable artifacts

Pushes and pull requests build and validate packages without uploading packages or
failure traces. WebAssembly and JavaScript checks share one runner, so there is no
intermediate artifact transfer.

To keep downloadable packages, open **Actions**, select **CI** or the browser
extension workflow, choose **Run workflow**, and enable **publish_artifacts**.
The checkbox defaults to off; a manual run alone only requests validation.
Uploaded packages and optional failure diagnostics are retained for **one day**.

Version tags beginning with `v` run **Build validated release assets**. Each platform
uploads its tested packages directly to a **draft GitHub Release**, without using
Actions artifact storage. The final job checks archive contents and creates the
checksum inventory and categorized download tables, including direct links and sizes.
The catalogue uses the version's changelog and rejects unlisted package files.
Release titles and Git tags use `vX.Y.Z`; package versions use `X.Y.Z`.
Publication remains a separate step after every build succeeds;
npm and PyPI use those same validated files. Routine workflows do not also run on tags.

**GitHub Pages remains automatic on `main` after successful site tests.** Its
one-day deployment artifact is required to publish the site and is exempt from
the package opt-in. The site's manual checkbox only enables failure diagnostics.

To validate a filter change locally:

```sh
python tests/tooling/ci_changes_tests.py
python tests/tooling/workflow_artifact_tests.py
python tools/dev/check-docs.py
actionlint .github/workflows/changes.yml .github/workflows/ci.yml .github/workflows/docs.yml .github/workflows/pages.yml
```
