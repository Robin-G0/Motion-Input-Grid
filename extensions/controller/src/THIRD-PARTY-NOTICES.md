# Bundled runtime notices

Motion Input Grid 1.1.0 and its bundled MediaPipe assets retain their licenses
under `mig/LICENSE` and `mig/licenses/`. Package files are pinned by package-lock.json.

This local build recompiles the MIG 1.1.0 sources with Emscripten 4.0.15 and
`DYNAMIC_EXECUTION=0` for Manifest V3. The web binding adds a read-only grid accessor
so configuration regions can be rendered using the actual engine transform.
The recognition core also fixes rearming during cooldown and direct returns to
the starting region. Its source hashes are in the same provenance document.
The glue and WASM differ from the npm release;
their hashes and the modified binding hash are recorded in `mig/grid-provenance.json`.
The matching sources and `scripts/rebuild-grid-runtime.py` are in the source archive.
The older `scripts/csp-runtime.mjs` transformation is retained for historical review
but is not applied to this rebuilt runtime.

Copyright 2012 The Emscripten Authors. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
