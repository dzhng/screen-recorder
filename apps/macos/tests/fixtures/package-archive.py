"""Generated hostile ZIPs: standard writer plus bounded test-only header mutations."""
import json, struct, sys, zipfile, zlib
from pathlib import Path

fixture, output, mode = sys.argv[1:]
files = json.loads(Path(fixture).read_text())
extras = []
compression = zipfile.ZIP_STORED
if mode == 'hash': files['source/video.mov'] += '!'
if mode == 'deflate': compression = zipfile.ZIP_DEFLATED
if mode in ['extra', 'bad-central', 'bad-local', 'undercount', 'undercount-bad']:
    extras.append(('unexpected.txt', 'extra', None))
if mode == 'mac': extras.append(('__MACOSX/source/._video.mov', 'extra', None))
if mode == 'duplicate': extras.append(('source/video.mov', files['source/video.mov'], None))
if mode == 'case': extras.append(('SOURCE/video.mov', 'extra', None))
if mode == 'directory': extras.append(('extra/', '', 0o40700))
if mode == 'file-directory': extras.append(('source', 'extra', None))
if mode == 'symlink': extras.append(('source/link', '/tmp/outside', 0o120777))
if mode == 'fifo': extras.append(('source/fifo', '', 0o010600))
if mode == 'absolute': extras.append(('/outside', 'extra', None))
if mode == 'parent': extras.append(('../outside', 'extra', None))
if mode == 'backslash': extras.append(('source\\outside', 'extra', None))
if mode == 'nul': extras.append(('source/video.movXignored', files['source/video.mov'], None))
if mode == 'nul-empty': extras.append(('Xignored', 'extra', None))
if mode in ['unicode-duplicate', 'unicode-parent', 'unicode-alias']:
    alias = 'source/video.mov' if mode != 'unicode-parent' else '../outside'
    if mode == 'unicode-alias': del files['source/video.mov']
    info = zipfile.ZipInfo('encoded-name')
    name = info.filename.encode()
    value = b'\x01' + struct.pack('<I', zlib.crc32(name)) + alias.encode()
    info.extra = struct.pack('<HH', 0x7075, len(value)) + value
    extras.append((info, 'generated source', None))
if mode in ['metadata-many', 'metadata-default']: extras.extend((f'evidence/{i}', '', None) for i in range(150000 if mode == 'metadata-default' else 50000))
if mode == 'metadata-large':
    info = zipfile.ZipInfo('evidence/padded')
    info.extra = struct.pack('<HH', 0xffff, 60000) + bytes(60000)
    extras.append((info, '', None))
with zipfile.ZipFile(output, 'w', compression=compression) as archive:
    for name, value in files.items(): archive.writestr(name, value)
    for name, value, permissions in extras:
        if permissions is not None:
            name = zipfile.ZipInfo(name)
            name.create_system = 3
            name.external_attr = permissions << 16
        archive.writestr(name, value)
raw = bytearray(Path(output).read_bytes())
end = raw.rfind(b'PK\x05\x06')
central = raw.rfind(b'PK\x01\x02')
if mode in ['undercount', 'undercount-bad']:
    count = struct.unpack_from('<H', raw, end+8)[0] - 1
    struct.pack_into('<HH', raw, end+8, count, count)
if mode in ['bad-central', 'undercount-bad']: raw[central:central+4] = b'BAD!'
if mode == 'bad-local':
    local = struct.unpack_from('<I', raw, central+42)[0]
    raw[local:local+4] = b'BAD!'
if mode == 'crc': raw[raw.index(b'generated source')] = ord('X')
if mode == 'nul': raw = raw.replace(b'source/video.movXignored', b'source/video.mov\x00ignored')
if mode == 'nul-empty': raw = raw.replace(b'Xignored', b'\x00ignored')
if mode == 'encrypted':
    # Declaration suffices to reject, without requiring an encryption library.
    struct.pack_into('<H', raw, central+8, struct.unpack_from('<H', raw, central+8)[0] | 1)
if mode == 'size-lie': struct.pack_into('<I', raw, central+24, 0)
Path(output).write_bytes(raw)
