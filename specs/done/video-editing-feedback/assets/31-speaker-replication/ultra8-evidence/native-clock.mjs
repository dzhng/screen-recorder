import assert from "node:assert/strict";
import { interpret } from "../hysteresis-evidence/interpret.mjs";
export function sourceTurns(matrix, onset, offset, frameSamples, sourceFrames) {
  assert(Number.isInteger(frameSamples) && frameSamples > 0);
  const turns = interpret(matrix, onset, offset).map((turn) => ({
    speaker: turn.speaker,
    start: (Math.round(turn.start * 100) * frameSamples) / 16000,
    end: (Math.round(turn.end * 100) * frameSamples) / 16000,
  }));
  for (const turn of turns)
    assert(
      0 <= turn.start && turn.start < turn.end && turn.end <= sourceFrames / 16000,
      "Native interpreted turn exceeds physical source support",
    );
  return turns;
}
