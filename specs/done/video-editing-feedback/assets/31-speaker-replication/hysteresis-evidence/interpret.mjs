// Research interpretation only; it accepts observations, never reference labels.
export function interpret(matrix, onset, offset) {
  const turns = [];
  for (let slot = 0; slot < matrix[0].length; slot++) {
    let active = false;
    let start = 0;
    for (let frame = 0; frame < matrix.length; frame++) {
      const score = matrix[frame][slot];
      const time = Math.round(frame * 0.01 * 100) / 100;
      if (active && score < offset) {
        turns.push({ speaker: `speaker_${slot}`, start, end: time });
        active = false;
      } else if (!active && score > onset) {
        start = time;
        active = true;
      }
    }
    if (active)
      turns.push({
        speaker: `speaker_${slot}`,
        start,
        end: Math.round(matrix.length * 0.01 * 100) / 100,
      });
  }
  return turns;
}
