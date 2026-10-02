"""Model-root-relative evidence inventory shared by the repository research entries."""

import hashlib


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def model_files(root):
    return [
        {
            "path": str(path.relative_to(root)),
            "bytes": path.stat().st_size,
            "sha256": file_sha256(path),
        }
        for path in sorted(root.rglob("*"))
        if path.is_file() and ".cache" not in path.relative_to(root).parts
    ]
