/** Independent authored sample cells, with no composition compiler or native output input. */
export function* authoredDryBlocks(period, placements, width, frames) {
  const events = new Map();
  for (const clip of placements) {
    const start = Math.floor((clip.startUs * 48000) / 1e6),
      end = Math.floor((clip.endUs * 48000) / 1e6),
      sourceFrames = Math.ceil(((clip.endUs - clip.startUs) * 48000) / 1e6);
    for (const [at, add] of [
      [start, true],
      [end, false],
    ]) {
      const list = events.get(at) ?? [];
      list.push({ clip, start, sourceFrames, add });
      events.set(at, list);
    }
  }
  const active = new Map();
  let ordered = [];
  for (let first = 0; first < frames; first += 8192) {
    const count = Math.min(8192, frames - first),
      bytes = Buffer.alloc(count * 8);
    for (let i = 0; i < count; i++) {
      const frame = first + i;
      if (events.has(frame)) {
        for (const item of events.get(frame)) {
          if (item.add) active.set(item.clip, item);
          else active.delete(item.clip);
        }
        ordered = [...active.values()].sort((a, b) => a.clip.lane - b.clip.lane);
      }
      for (let channel = 0; channel < 2; channel++) {
        let sum = 0;
        for (const item of ordered) {
          const sourceFrame = frame - item.start;
          // Project endpoints floor; source support retains its intersecting terminal cell.
          const sample =
            sourceFrame < item.sourceFrames ? period.readFloatLE(sourceFrame * 8 + channel * 4) : 0;
          sum = Math.fround(sum + Math.fround(sample / width));
        }
        bytes.writeFloatLE(sum, i * 8 + channel * 4);
      }
    }
    yield bytes;
  }
}
