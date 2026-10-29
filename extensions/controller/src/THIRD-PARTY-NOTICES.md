# Bundled runtime notices

Motion Input Grid 1.1.0 and its bundled MediaPipe assets retain their licenses
under `mig/LICENSE` and `mig/licenses/`. Package files are pinned by package-lock.json.

The build replaces two JavaScript invoker factories in the pinned MIG glue with
static implementations, following the `DYNAMIC_EXECUTION=0` branches of
Emscripten 4.0.15 (`src/lib/libembind.js` and `src/lib/libemval.js`).
This removes dynamic JavaScript evaluation for Manifest V3. The original glue hash
is checked before transformation; the WASM binary is unchanged. The replacements
are maintained in `scripts/csp-runtime.mjs` in the source repository.

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
