"""Inspect normal/delay PE imports without dumpbin, PATH or developer DLL lookup."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct

# Direct imports from application payloads must be OS components or bundled.
# Being present in System32 alone is not proof that a DLL ships with Windows:
# developer-installed CRT/OpenMP/other libraries must never silently qualify.
WINDOWS_COMPONENTS = set("""
advapi32.dll bcrypt.dll cabinet.dll cfgmgr32.dll comctl32.dll comdlg32.dll
crypt32.dll d3d11.dll d3d12.dll dbghelp.dll dnsapi.dll dwmapi.dll dwrite.dll
dxgi.dll dxva2.dll gdi32.dll gdiplus.dll hid.dll imm32.dll iphlpapi.dll
kernel32.dll mf.dll mfplat.dll mfreadwrite.dll mfuuid.dll mpr.dll msimg32.dll
msvcrt.dll ncrypt.dll ntdll.dll ole32.dll oleaut32.dll opengl32.dll powrprof.dll
propsys.dll psapi.dll rpcrt4.dll secur32.dll setupapi.dll shell32.dll shcore.dll
shlwapi.dll user32.dll userenv.dll usp10.dll uxtheme.dll version.dll winhttp.dll
wininet.dll winmm.dll winspool.drv wintrust.dll ws2_32.dll wtsapi32.dll
ucrtbase.dll
""".split())


def pe_imports(path):
    data = Path(path).read_bytes()
    def number(offset, fmt="I"):
        return struct.unpack_from("<" + fmt, data, offset)[0]
    if data[:2] != b"MZ":
        raise ValueError(f"Not a PE file: {path}")
    pe = number(0x3c)
    if data[pe:pe+4] != b"PE\0\0":
        raise ValueError(f"Invalid PE signature: {path}")
    sections = number(pe+6, "H")
    optional_size = number(pe+20, "H")
    optional = pe+24
    magic = number(optional, "H")
    if magic not in (0x10b, 0x20b):
        raise ValueError(f"Unsupported PE optional header: {path}")
    wide = magic == 0x20b
    image_base = number(optional+(24 if wide else 28), "Q" if wide else "I")
    count = number(optional+(108 if wide else 92))
    table = optional+(112 if wide else 96)
    ranges = []
    for index in range(sections):
        section = optional+optional_size+index*40
        ranges.append((number(section+12), number(section+8), number(section+16), number(section+20)))
    def offset(rva):
        if rva < number(optional+60):
            return rva
        for address, virtual_size, raw_size, raw_pointer in ranges:
            if address <= rva < address+max(virtual_size, raw_size) and rva-address < raw_size:
                return raw_pointer+rva-address
        raise ValueError(f"Unmapped PE RVA {rva:#x}: {path}")
    def cstring(rva):
        start = offset(rva)
        end = data.index(b"\0", start, min(len(data), start+4096))
        value = data[start:end].decode("ascii").lower()
        if not value or Path(value).name != value or "/" in value or "\\" in value:
            raise ValueError(f"Unsafe DLL import: {value}")
        return value
    def imports(index, delayed=False):
        if index >= count:
            return []
        rva, size = struct.unpack_from("<II", data, table+8*index)
        if not rva or not size:
            return []
        start = offset(rva)
        stride = 32 if delayed else 20
        result = set()
        for position in range(start, min(start+size, len(data))-stride+1, stride):
            fields = struct.unpack_from("<"+"I"*(stride//4), data, position)
            if not any(fields):
                return sorted(result)
            name = fields[1] if delayed else fields[3]
            if delayed and not (fields[0] & 1):
                name -= image_base
            result.add(cstring(name))
        raise ValueError(f"Unterminated PE import directory: {path}")
    forwarded = set()
    if count:
        export_rva, export_size = struct.unpack_from("<II", data, table)
        if export_rva and export_size:
            exports = offset(export_rva)
            functions = number(exports+20)
            addresses = offset(number(exports+28)) if functions else 0
            if functions > len(data)//4:
                raise ValueError(f"Invalid PE export count: {path}")
            for index in range(functions):
                address = number(addresses+index*4)
                if export_rva <= address < export_rva+export_size:
                    target = cstring(address).rsplit(".", 1)[0]
                    forwarded.add(target if target.endswith(".dll") else target+".dll")
    return {"machine": number(pe+4, "H"), "imports": imports(1), "delay_imports": imports(13, True), "forwarded_dlls": sorted(forwarded)}


def api_contract(name):
    return name.startswith(("api-ms-", "ext-ms-")) and name.endswith(".dll")


def audit_windows(payload, system_directory=None):
    """Traverse every bundled PE and its complete System32 import closure.

    Dynamic MediaPipe loading is included by seeding all bundled EXEs/DLLs.
    Only normal/delay PE imports can be statically enumerated; arbitrary OS
    runtime plugins/drivers remain system facilities, not developer dependencies.
    """
    payload = Path(payload)
    system = Path(system_directory or Path(os.environ["SystemRoot"]) / "System32")
    bundled = {p.name.lower(): p for p in payload.iterdir() if p.suffix.lower() in (".dll", ".exe")}
    system_files = {p.name.lower(): p for p in system.iterdir() if p.is_file()}
    pending = [(name, path, "bundled") for name, path in sorted(bundled.items())]
    graph, contracts, optional_os = {}, set(), {}
    while pending:
        name, path, kind = pending.pop()
        if name in graph:
            continue
        imports = pe_imports(path)
        if imports["machine"] != 0x8664:
            raise ValueError(f"Non-x64 dependency: {name}")
        graph[name] = {"source": kind, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), **imports}
        for dependency in imports["imports"] + imports["delay_imports"] + imports["forwarded_dlls"]:
            if api_contract(dependency):
                contracts.add(dependency)
            elif kind == "bundled" and dependency in bundled:
                pending.append((dependency, bundled[dependency], "bundled"))
            elif dependency in system_files and (kind == "windows" or dependency in WINDOWS_COMPONENTS):
                if dependency not in {"msvcp_win.dll", "msvcp110_win.dll"} and dependency.startswith(("msvcp", "vcruntime", "concrt", "vccorlib", "vcomp")):
                    raise ValueError(f"Developer runtime would be loaded from System32: {name} -> {dependency}")
                pending.append((dependency, system_files[dependency], "windows"))
            elif kind == "windows" and dependency in imports["delay_imports"] and not dependency.startswith(("msvcp", "vcruntime", "concrt", "vccorlib", "vcomp")):
                # Windows itself delay-loads optional edition/features (for
                # example enterprise attestation). Do not claim these exist.
                optional_os.setdefault(dependency, []).append(name)
            else:
                raise ValueError(f"Unbundled/non-OS DLL dependency: {name} -> {dependency}")
    return {"schema": 1, "architecture": "x64", "resolution": "payload or Windows System32/API contracts only; no PATH search",
            "roots": sorted(bundled), "api_contracts": sorted(contracts), "modules": dict(sorted(graph.items())),
            "missing_optional_windows_delay_imports": dict(sorted(optional_os.items())),
            "limitations": "Static normal/delay import closure plus all bundled dynamically loaded DLLs. OS-selected camera/display drivers and plugins need target-machine testing."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("payload", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(json.dumps(audit_windows(args.payload), indent=2)+"\n")
