"""Validate wheel payloads and canonicalize RECORD after native-library repair."""
import base64
import csv
import hashlib
import io
import os
from pathlib import Path
import tempfile
import zipfile


def _inspect(archive, allow_directories=False):
    members = archive.infolist()
    names = [member.filename for member in members]
    if len(set(names)) != len(names):
        raise ValueError("Wheel contains duplicate ZIP entries")
    for name in names:
        if name.startswith("/") or "\\" in name or ".." in name.split("/"):
            raise ValueError(f"Unsafe wheel path: {name}")
    records = [name for name in names if name.endswith(".dist-info/RECORD")]
    if len(records) != 1:
        raise ValueError("Wheel must contain exactly one RECORD")
    record = records[0]
    signatures = {record + suffix for suffix in (".jws", ".p7s")}
    files = {member.filename for member in members if not member.is_dir()}
    rows = {}
    source = archive.read(record).decode("utf-8")
    for row in csv.reader(io.StringIO(source, newline="")):
        if not row and allow_directories:
            continue  # Older tooling emitted CRCRLF, producing empty CSV rows.
        if len(row) != 3:
            raise ValueError("Malformed wheel RECORD row")
        name, digest, size = row
        if name in rows:
            raise ValueError(f"Duplicate RECORD entry: {name}")
        rows[name] = (digest, size)
    directories = {member.filename for member in members if member.is_dir()}
    expected = files - signatures
    recorded = set(rows)
    if allow_directories:
        recorded -= directories
    if recorded != expected:
        raise ValueError(f"RECORD file list mismatch: missing={sorted(expected - recorded)}, "
                         f"extra={sorted(recorded - expected)}")
    if rows[record] != ("", ""):
        raise ValueError("RECORD must not hash itself")
    for name in expected - {record}:
        digest, size = rows[name]
        algorithm, separator, encoded = digest.partition("=")
        if not separator or algorithm not in ("sha256", "sha384", "sha512"):
            raise ValueError(f"Missing or unsupported RECORD hash: {name}")
        data = archive.read(name)
        actual = base64.urlsafe_b64encode(hashlib.new(algorithm, data).digest()).rstrip(b"=").decode()
        if encoded != actual or not size.isdecimal() or int(size) != len(data):
            raise ValueError(f"RECORD hash or size mismatch: {name}")
    return record, members


def validate_wheel(path):
    """Require the exact file list, hashes and byte sizes expected by installers."""
    with zipfile.ZipFile(path) as archive:
        _inspect(archive)


def normalize_wheel(path):
    """Remove directory records without concealing missing or corrupted files."""
    path = Path(path)
    temporary = None
    try:
        with zipfile.ZipFile(path) as original:
            record, members = _inspect(original, allow_directories=True)
            if any(member.filename in (record + ".jws", record + ".p7s") for member in members):
                raise ValueError("Cannot rewrite a signed RECORD")
            output = io.StringIO(newline="")
            writer = csv.writer(output, lineterminator="\n")
            with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".whl", delete=False) as handle:
                temporary = Path(handle.name)
            with zipfile.ZipFile(temporary, "w") as repaired:
                repaired.comment = original.comment
                for member in members:
                    if member.is_dir() or member.filename == record:
                        continue
                    data = original.read(member.filename)
                    digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=").decode()
                    writer.writerow((member.filename, "sha256=" + digest, len(data)))
                    repaired.writestr(member, data)
                writer.writerow((record, "", ""))
                repaired.writestr(original.getinfo(record), output.getvalue().encode("utf-8"))
        validate_wheel(temporary)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
