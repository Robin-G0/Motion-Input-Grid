"""Verify shared frozen dependencies and example SDK staging."""
import importlib.util
import json
import shutil
from pathlib import Path
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/lib'))


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


(ROOT / 'build').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=ROOT / 'build', prefix='example-package-test-') as temporary:
    root = Path(temporary)
    source = root / 'source'
    source.mkdir()
    (source / 'python.dll').write_bytes(b'python')
    destination = root / 'destination'
    merger = load('examples_package', 'packaging/package-examples.py').merge_runtime
    merger(source, destination)
    merger(source, destination)
    (source / 'python.dll').write_bytes(b'incompatible')
    try:
        merger(source, destination)
    except RuntimeError:
        pass
    else:
        raise AssertionError('Conflicting runtimes cannot be silently merged')
    freezer = load('freeze_examples', 'packaging/freeze-python-examples.py')
    copies = [root / 'first.zip', root / 'second.zip']
    for year, copy in zip((2000, 2020), copies):
        with zipfile.ZipFile(copy, 'w') as output:
            output.writestr(zipfile.ZipInfo('module.pyc', (year, 1, 1, 0, 0, 0)), b'module')
        freezer.canonicalize_python_library(copy)
    assert copies[0].read_bytes() == copies[1].read_bytes()
    with zipfile.ZipFile(copies[0]) as archive:
        assert archive.read('module.pyc') == b'module'
    packager = load('sdk_staging', 'packaging/package-examples.py')
    sdk = root / 'sdk'
    (sdk / 'include').mkdir(parents=True)
    (sdk / 'include/header.hpp').write_text('header')
    (sdk / 'bin/models').mkdir(parents=True)
    (sdk / 'bin/mig-c.dll').write_bytes(b'abi')
    (sdk / 'bin/motion-input-grid-controller.exe').write_bytes(b'app')
    (sdk / 'bin/models/full.task').write_bytes(b'model')
    staged = root / 'staged-sdk'
    packager.copy_example_sdk(sdk, staged)
    assert (staged / 'bin/mig-c.dll').read_bytes() == b'abi'
    assert not (staged / 'bin/motion-input-grid-controller.exe').exists()
    assert not (staged / 'bin/models').exists()
    single = load('single_tutorial', 'packaging/package-single-example.py')
    examples = root / 'prepared'
    (examples / 'examples').mkdir(parents=True)
    (examples / 'licenses').mkdir()
    (examples / 'runtime/models').mkdir(parents=True)
    (examples / 'runtime/libmediapipe.dll').write_bytes(b'native')
    for name in ('pose_landmarker_full.task', 'pose_landmarker_lite.task', 'hand_landmarker.task'):
        (examples / 'runtime/models' / name).write_bytes(b'model')
    (examples / 'bindings/python/mig').mkdir(parents=True)
    (examples / 'bindings/python/mig/__init__.py').write_text('# binding')
    (examples / 'LICENSE').write_text('license')
    shutil.copytree(ROOT / 'examples/python-tkinter', examples / 'examples/python-tkinter')
    isolated = root / 'isolated'
    single.assemble(examples, isolated, 'python-tkinter', 'windows-x64')
    assert (isolated / 'example_usage.py').is_file()
    assert (isolated / 'configuration/raised-hands.json').is_file()
    assert not (isolated / 'examples').exists()
    assert not (isolated / 'runtime/models/pose_landmarker_full.task').exists()
    assert (isolated / 'runtime/models/pose_landmarker_lite.task').is_file()
    assert not (isolated / 'sdk').exists(), 'Python tutorial does not need C++ development libraries'
    browser = load('browser_tutorial', 'packaging/package-browser-example.py')
    (examples / 'licenses/javascript').mkdir()
    (examples / 'licenses/javascript/react-LICENSE').write_text('license')
    (examples / 'bindings/javascript').mkdir()
    (examples / 'bindings/javascript/package.json').write_text('{"name":"motion-input-grid"}')
    (examples / 'examples/web/licenses').mkdir(parents=True)
    (examples / 'examples/web/licenses/MediaPipe-LICENSE').write_text('license')
    (examples / 'examples/web/README.md').write_text(
        '# Browser\n[API](../../bindings/javascript/README.md)\n')
    (examples / 'examples/web/README.fr.md').write_text('# Navigateur\n')
    small_browser = root / 'browser'
    browser.assemble(examples, small_browser, 'web')
    assert (small_browser / 'licenses/MediaPipe-LICENSE').is_file()
    assert (small_browser / 'licenses/javascript/react-LICENSE').is_file()
    package = json.loads((small_browser / 'package.json').read_text())
    assert (small_browser / package['dependencies']['motion-input-grid'].removeprefix('file:')).is_dir()
    assert '../../' not in (small_browser / 'run.sh').read_text()
    assert '(dependencies/motion-input-grid/README.md)' in (small_browser / 'README.md').read_text()
    (examples / 'examples/next/out/mig').mkdir(parents=True)
    (examples / 'examples/next/out/index.html').write_text('compiled')
    (examples / 'examples/next/out/mig/mig.wasm').write_bytes(b'wasm')
    (examples / 'examples/next/package.json').write_text(
        '{"dependencies":{"motion-input-grid":"1.0.2"}}')
    (examples / 'examples/next/README.md').write_text('# Next.js\n')
    (examples / 'examples/next/README.fr.md').write_text('# Next.js\n')
    next_browser = root / 'next-browser'
    browser.assemble(examples, next_browser, 'next')
    assert (next_browser / 'out/index.html').read_text() == 'compiled'
    assert (next_browser / 'out/mig/mig.wasm').read_bytes() == b'wasm'
    archiver = load('combined_archiver', 'packaging/archive-examples.py')
    (small_browser / 'README.md').write_text('[Build](tools/build/build-windows.ps1)\n')
    # Removed optional source links resolve to matching-version documentation;
    # the manifest must describe the rewritten files, not their earlier bytes.
    archiver.archive_examples(small_browser, root / 'tutorial.tar.gz')
    from release_metadata import release_version
    expected_link = (f'https://github.com/Robin-G0/Motion-Input-Grid/blob/v{release_version()}/'
                     'tools/build/build-windows.ps1')
    assert f'[Build]({expected_link})' in (small_browser / 'README.md').read_text()
    import hashlib
    manifest = json.loads((small_browser / 'manifest.json').read_text())
    assert manifest['sha256']['README.md'] == hashlib.sha256((small_browser / 'README.md').read_bytes()).hexdigest()
print('Shared-runtime conflicts, deterministic libraries and example SDK staging passed')
