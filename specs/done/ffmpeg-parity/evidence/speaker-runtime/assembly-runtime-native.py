"""Explicit Mach-O packaging metadata changes; inference and donor files stay external."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess


def inspect(path):
    data = path.read_bytes()
    assert data[:4] == bytes.fromhex("cffaedfe") and struct.unpack_from("<I", data, 4)[0] == 0x100000c, "Expected thin arm64 Mach-O"
    offset = 32
    result = {"sections": [], "loads": [], "rpaths": [], "installIds": []}
    for _ in range(struct.unpack_from("<I", data, 16)[0]):
        command, size = struct.unpack_from("<II", data, offset)
        assert size >= 8 and offset + size <= len(data), "Invalid native load command"
        if command == 0x19:
            for index in range(struct.unpack_from("<I", data, offset + 64)[0]):
                section = offset + 72 + index * 80
                assert section + 80 <= offset + size, "Invalid native section"
                name = data[section:section + 16].split(b"\0")[0].decode()
                segment = data[section + 16:section + 32].split(b"\0")[0].decode()
                address, length = struct.unpack_from("<QQ", data, section + 32)
                start = struct.unpack_from("<I", data, section + 48)[0]
                flags = struct.unpack_from("<I", data, section + 64)[0]
                zero_fill = (flags & 0xff) in [1, 12, 18]
                payload = b"" if zero_fill else data[start:start + length]
                assert zero_fill or len(payload) == length, "Native section exceeds file"
                result["sections"].append({"segment": segment, "section": name,
                    "address": address, "offset": start, "bytes": length, "flags": flags,
                    "zeroFill": zero_fill, "sha256": hashlib.sha256(payload).hexdigest()})
        elif command in [0x8000001c, 0xd, 0xc, 0x80000018, 0x8000001f, 0x20, 0x80000023]:
            name_offset = struct.unpack_from("<I", data, offset + 8)[0]
            name = data[offset + name_offset:offset + size].split(b"\0")[0].decode()
            key = "rpaths" if command == 0x8000001c else "installIds" if command == 0xd else "loads"
            result[key].append(name)
        offset += size
    return result


def relocate(policy_path, bundle, sources, out, clone_file, sha):
    policy = json.loads(policy_path.read_text())
    assert set(policy) == {"files"} and isinstance(policy["files"], list), "Invalid native policy"
    assert len({entry["path"] for entry in policy["files"]}) == len(policy["files"]), "Duplicate native policy path"
    assert sum(Path(sources[entry["path"]]).stat().st_size * 2 for entry in policy["files"]) <= 64 * 1024 * 1024, "Native diagnostic operands exceed 64 MiB budget"
    report = {"verified": False, "policySha256": sha(policy_path), "files": []}
    report_path = out / "native-relocation.json"
    changes = {}

    def save():
        report_path.write_text(json.dumps(report, indent=2) + "\n")

    save()
    for index, entry in enumerate(policy["files"]):
        assert set(entry) == {"path", "sourceSha256", "removeRpaths"}, "Invalid native policy fields"
        target = bundle / entry["path"]
        source = Path(sources[entry["path"]])
        before_file = out / f"native-operands/{index}/before"
        after_file = before_file.with_name("after")
        before_file.parent.mkdir(parents=True)
        clone_file(source, before_file)
        row = {"path": entry["path"], "sourceFile": str(source),
               "beforeFile": str(before_file.relative_to(out)),
               "afterFile": str(after_file.relative_to(out)),
               "sourceSha256": sha(before_file), "before": inspect(before_file), "verified": False}
        report["files"].append(row)
        save()
        assert row["sourceSha256"] == entry["sourceSha256"] and sha(target) == entry["sourceSha256"], "Native policy/source identity mismatch"
        remove = entry["removeRpaths"]
        assert isinstance(remove, list) and remove and len(set(remove)) == len(remove), "Native policy requires distinct search paths"
        assert all(path in row["before"]["rpaths"] and path.startswith("/") and
                   path != "/usr/lib" and not path.startswith(("/usr/lib/", "/System/Library/"))
                   for path in remove), "Only identified foreign absolute rpaths may be removed"
        try:
            commands = [["/usr/bin/install_name_tool", *[part for path in remove for part in ["-delete_rpath", path]], str(target)],
                        ["/usr/bin/codesign", "--force", "--sign", "-", str(target)],
                        ["/usr/bin/codesign", "--verify", "--strict", str(target)]]
            row["commands"] = []
            for command in commands:
                result = subprocess.run(command, capture_output=True, text=True, timeout=10)
                row["commands"].append({"args": command, "exitCode": result.returncode,
                    "stdout": result.stdout, "stderr": result.stderr})
                save()
                assert result.returncode == 0, "Native packaging command failed"
        finally:
            # Retain the complete final operand even when a packaging command fails.
            clone_file(target, after_file)
            row["finalSha256"] = sha(after_file)
            row["after"] = inspect(after_file)
            save()
        assert row["before"]["sections"] == row["after"]["sections"], "Native section content/support changed"
        assert row["before"]["loads"] == row["after"]["loads"] and row["before"]["installIds"] == row["after"]["installIds"], "Native dependency identities changed"
        assert row["after"]["rpaths"] == [path for path in row["before"]["rpaths"] if path not in remove], "Unexpected native search-path change"
        assert sha(source) == row["sourceSha256"], "Native donor changed"
        row["verified"] = True
        changes[entry["path"]] = row
        save()
    report["verified"] = True
    save()
    return report, changes
