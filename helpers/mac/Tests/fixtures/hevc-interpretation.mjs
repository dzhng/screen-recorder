import assert from "node:assert/strict";

// Independent one-track MOV mutation: packet lengths and ancestor sizes are authored,
// not produced by the native scanner. Input has moov after mdat and no audio.
export function movAtoms(data, start = 0, end = data.length, ancestors = [], result = []) {
  for (let at = start; at < end;) {
    const size = data.readUInt32BE(at),
      type = data.toString("ascii", at + 4, at + 8);
    assert.ok(size >= 8 && at + size <= end, `invalid authored ${type}`);
    const atom = { at, size, type, ancestors };
    result.push(atom);
    const offset = ["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf"].includes(type)
      ? 8
      : ["stsd", "dref"].includes(type)
        ? 16
        : type === "hvc1"
          ? 86
          : null;
    if (offset !== null) movAtoms(data, at + offset, at + size, [...ancestors, atom], result);
    at += size;
  }
  return result;
}

export function insertInterpretationPacket(original, nal, sampleOrdinal = 0) {
  const data = Buffer.from(original),
    atoms = movAtoms(data);
  const mdat = atoms.find((a) => a.type === "mdat"),
    moov = atoms.find((a) => a.type === "moov");
  const stsz = atoms.find((a) => a.type === "stsz"),
    stco = atoms.find((a) => a.type === "stco");
  assert.ok(mdat.at + mdat.size <= moov.at);
  assert.equal(data.readUInt32BE(stco.at + 12), 1, "author requires one chunk");
  const count = data.readUInt32BE(stsz.at + 16);
  assert.ok(sampleOrdinal < count);
  const constant = data.readUInt32BE(stsz.at + 12);
  assert.equal(constant, 0, "author requires explicit sample sizes");
  const sizes = Array.from({ length: count }, (_, i) => data.readUInt32BE(stsz.at + 20 + 4 * i));
  const at =
    data.readUInt32BE(stco.at + 16) + sizes.slice(0, sampleOrdinal).reduce((a, b) => a + b, 0);
  const prefix = Buffer.alloc(nal.length + 4);
  prefix.writeUInt32BE(nal.length);
  Buffer.from(nal).copy(prefix, 4);
  data.writeUInt32BE(sizes[sampleOrdinal] + prefix.length, stsz.at + 20 + sampleOrdinal * 4);
  data.writeUInt32BE(mdat.size + prefix.length, mdat.at);
  return Buffer.concat([data.subarray(0, at), prefix, data.subarray(at)]);
}

export function insertInterpretationAtom(original, name = "dvcC") {
  const data = Buffer.from(original),
    sample = movAtoms(data).find((a) => a.type === "hvc1");
  assert.ok(sample);
  const atom = Buffer.alloc(16);
  atom.writeUInt32BE(atom.length);
  atom.write(name, 4, "ascii");
  Buffer.from([1, 0, 8, 7, 0, 0, 0, 0]).copy(atom, 8);
  for (const ancestor of [...sample.ancestors, sample]) {
    data.writeUInt32BE(ancestor.size + atom.length, ancestor.at);
  }
  const at = sample.at + sample.size;
  return Buffer.concat([data.subarray(0, at), atom, data.subarray(at)]);
}

export function hideFirstPresentedSample(original) {
  const data = Buffer.from(original),
    atoms = movAtoms(data);
  const elst = atoms.find((a) => a.type === "elst"),
    stts = atoms.find((a) => a.type === "stts");
  const mdhd = atoms.find((a) => a.type === "mdhd"),
    mvhd = atoms.find((a) => a.type === "mvhd");
  assert.equal(data[elst.at + 8], 0);
  assert.equal(data.readUInt32BE(elst.at + 12), 1);
  assert.equal(data[mdhd.at + 8], 0);
  assert.equal(data[mvhd.at + 8], 0);
  const frame = data.readUInt32BE(stts.at + 20),
    scale = data.readUInt32BE(mdhd.at + 20);
  const movieScale = data.readUInt32BE(mvhd.at + 20);
  data.writeInt32BE(frame, elst.at + 20);
  data.writeUInt32BE(
    data.readUInt32BE(elst.at + 16) - Math.floor((frame * movieScale) / scale),
    elst.at + 16,
  );
  return data;
}

export function insertConfigurationInterpretation(original, nal = [78, 1, 4, 1, 181, 128]) {
  const data = Buffer.from(original),
    config = movAtoms(data).find((a) => a.type === "hvcC");
  assert.ok(config);
  const array = Buffer.alloc(5 + nal.length);
  array[0] = (nal[0] >> 1) & 63;
  array.writeUInt16BE(1, 1);
  array.writeUInt16BE(nal.length, 3);
  Buffer.from(nal).copy(array, 5);
  data[config.at + 8 + 22] += 1;
  for (const ancestor of [...config.ancestors, config])
    data.writeUInt32BE(ancestor.size + array.length, ancestor.at);
  const at = config.at + config.size;
  return Buffer.concat([data.subarray(0, at), array, data.subarray(at)]);
}

export function externalStorageReference(original, externalURL) {
  const data = Buffer.from(original),
    entry = movAtoms(data).find((a) => a.type === "url ");
  assert.ok(entry);
  const address = Buffer.from(externalURL + "\0"),
    atom = Buffer.alloc(12 + address.length);
  atom.writeUInt32BE(atom.length);
  atom.write("url ", 4);
  address.copy(atom, 12);
  for (const ancestor of entry.ancestors)
    data.writeUInt32BE(ancestor.size + atom.length - entry.size, ancestor.at);
  return Buffer.concat([data.subarray(0, entry.at), atom, data.subarray(entry.at + entry.size)]);
}

export function replaceFirstNALType(original, type) {
  const data = Buffer.from(original),
    offset = movAtoms(data).find((a) => a.type === "stco");
  const at = data.readUInt32BE(offset.at + 16) + 4;
  data[at] = (type << 1) | (data[at] & 1);
  return data;
}

export function appendConfigurationPadding(original, count) {
  const data = Buffer.from(original),
    config = movAtoms(data).find((a) => a.type === "hvcC");
  const bytes = Buffer.alloc(count, 255);
  for (const ancestor of [...config.ancestors, config])
    data.writeUInt32BE(ancestor.size + count, ancestor.at);
  const at = config.at + config.size;
  return Buffer.concat([data.subarray(0, at), bytes, data.subarray(at)]);
}

export function duplicateConfigurationParameterSet(original, type = 33) {
  const data = Buffer.from(original),
    config = movAtoms(data).find((a) => a.type === "hvcC");
  let at = config.at + 8 + 23;
  for (let array = 0; array < data[config.at + 8 + 22]; array++) {
    const arrayType = data[at] & 63,
      countAt = at + 1,
      count = data.readUInt16BE(countAt);
    at += 3;
    for (let nal = 0; nal < count; nal++) {
      const length = data.readUInt16BE(at);
      if (arrayType === type) {
        const copy = Buffer.from(data.subarray(at, at + 2 + length));
        data.writeUInt16BE(count + 1, countAt);
        for (const ancestor of [...config.ancestors, config])
          data.writeUInt32BE(ancestor.size + copy.length, ancestor.at);
        return Buffer.concat([data.subarray(0, at), copy, data.subarray(at)]);
      }
      at += 2 + length;
    }
  }
  throw new Error("authored source omitted parameter set");
}

export function changeLaterSampleDescription(original) {
  let data = Buffer.from(original);
  const before = movAtoms(data),
    sample = before.find((a) => a.type === "hvc1");
  const stco = before.find((a) => a.type === "stco"),
    stsz = before.find((a) => a.type === "stsz");
  assert.equal(data.readUInt32BE(stsz.at + 16), 3);
  assert.equal(data.readUInt32BE(stsz.at + 12), 0);
  const sizes = [0, 1, 2].map((i) => data.readUInt32BE(stsz.at + 20 + 4 * i));
  const first = data.readUInt32BE(stco.at + 16),
    offsets = [first, first + sizes[0], first + sizes[0] + sizes[1]];
  const originalEntry = Buffer.from(data.subarray(sample.at, sample.at + sample.size));
  const changedEntry = Buffer.from(originalEntry);
  changedEntry.write("TST!", 20, "ascii");
  function replace(type, payload) {
    const atom = movAtoms(data).find((a) => a.type === type),
      replacement = Buffer.alloc(8 + payload.length);
    replacement.writeUInt32BE(replacement.length);
    replacement.write(type, 4);
    payload.copy(replacement, 8);
    for (const parent of atom.ancestors)
      data.writeUInt32BE(parent.size + replacement.length - atom.size, parent.at);
    data = Buffer.concat([
      data.subarray(0, atom.at),
      replacement,
      data.subarray(atom.at + atom.size),
    ]);
  }
  const descriptions = Buffer.alloc(8);
  descriptions.writeUInt32BE(2, 4);
  replace("stsd", Buffer.concat([descriptions, originalEntry, changedEntry]));
  const chunks = Buffer.alloc(8 + 2 * 12);
  chunks.writeUInt32BE(2, 4);
  for (const [i, firstChunk, description] of [
    [0, 1, 1],
    [1, 2, 2],
  ]) {
    chunks.writeUInt32BE(firstChunk, 8 + i * 12);
    chunks.writeUInt32BE(1, 12 + i * 12);
    chunks.writeUInt32BE(description, 16 + i * 12);
  }
  replace("stsc", chunks);
  const positions = Buffer.alloc(8 + 3 * 4);
  positions.writeUInt32BE(3, 4);
  offsets.forEach((offset, i) => positions.writeUInt32BE(offset, 8 + i * 4));
  replace("stco", positions);
  return data;
}
