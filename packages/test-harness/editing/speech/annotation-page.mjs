import { secondsToSourceUs } from "./annotation-time.mjs";

const audio = document.querySelector("#audio");
const canvas = document.querySelector("#waveform");
const zoom = document.querySelector("#zoom");
const confirmed = document.querySelector("#confirmed");
const save = document.querySelector("#save");
const status = document.querySelector("#status");
const fields = document.querySelector("#mark-fields");
const rows = [];
let context;
let viewStart = 0;
let saving = false;
let audioReady = false;
let audioUrl;
confirmed.checked = false;

function audioUnavailable() {
  audioReady = false;
  fields.disabled = true;
  document.querySelector("#audio-status").textContent =
    "The audio could not be loaded. Your marks are still here. Try loading it again.";
  document.querySelector("#reload-audio").hidden = false;
}
async function loadAudio() {
  document.querySelector("#reload-audio").hidden = true;
  document.querySelector("#audio-status").textContent = "Loading the complete recording…";
  try {
    const response = await fetch("/original.wav");
    if (!response.ok) throw new Error("Audio request failed");
    const blob = await response.blob();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audio.src = audioUrl;
    audio.load();
  } catch {
    audioUnavailable();
  }
}
audio.addEventListener("error", audioUnavailable);
audio.addEventListener("loadedmetadata", () => {
  if (
    !context ||
    !Number.isFinite(audio.duration) ||
    Math.abs(audio.duration - context.durationSeconds) > 0.001
  ) {
    audioUnavailable();
    return;
  }
  audioReady = true;
  fields.disabled = saving;
  document.querySelector("#audio-status").textContent =
    `${audio.duration.toFixed(2)} seconds loaded. Press ▶ to listen; audio does not start automatically.`;
});
document.querySelector("#reload-audio").addEventListener("click", () => {
  if (context) loadAudio();
  else window.location.reload();
});

const sourceTime = (seconds) =>
  `${(secondsToSourceUs(seconds, context.binding) / 1000000).toFixed(6)} s`;
const clipTime = (seconds) => `${seconds.toFixed(3)} s`;
function message(text, error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
}
function saveMode() {
  save.textContent = confirmed.checked ? "Save listening marks" : "Save draft";
  document.querySelector("#save-kind").textContent = confirmed.checked
    ? "Saves the edges you marked as listening evidence. Blank edges still remain unknown."
    : "Without confirmation, this saves a draft. Blank edges remain unknown in either case.";
}
function changed() {
  confirmed.checked = false;
  saveMode();
  message("Unsaved changes. Leave uncertain edges blank.");
}
function edgeReadout(input, output) {
  output.textContent =
    input.value === "" || !input.validity.valid
      ? "Unknown edge"
      : `Marked ${clipTime(Number(input.value))} in this clip`;
}
function buildRows() {
  for (const target of context.targets) {
    const row = document.createElement("div");
    row.className = "mark-row";
    const name = document.createElement("div");
    name.className = "target-name";
    name.textContent = target.text;
    row.append(name);
    const inputs = {};
    const error = document.createElement("p");
    error.className = "row-error";
    error.hidden = true;
    const clearError = () => {
      error.hidden = true;
      for (const { input } of Object.values(inputs)) input.removeAttribute("aria-invalid");
    };
    for (const edge of ["start", "end"]) {
      const cell = document.createElement("div");
      cell.className = "edge";
      const label = document.createElement("label");
      label.htmlFor = `${target.id}-${edge}`;
      label.textContent = `${edge === "start" ? "Start" : "End"} (clip seconds)`;
      const input = document.createElement("input");
      input.id = label.htmlFor;
      input.type = "number";
      input.min = "0";
      input.max = String(context.durationSeconds);
      input.step = "0.001";
      input.placeholder = "Unknown";
      input.setAttribute("aria-label", `${target.text} ${edge} in clip seconds`);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${edge === "start" ? "Start" : "End"} at playhead`;
      button.setAttribute("aria-label", `Mark ${target.text} ${edge} at playhead`);
      const readout = document.createElement("output");
      readout.htmlFor = input.id;
      edgeReadout(input, readout);
      input.addEventListener("input", () => {
        clearError();
        edgeReadout(input, readout);
        changed();
      });
      button.addEventListener("click", () => {
        clearError();
        const seconds = Math.max(0, Math.min(context.durationSeconds, audio.currentTime));
        input.value = seconds.toFixed(3);
        edgeReadout(input, readout);
        changed();
      });
      inputs[edge] = { input, readout };
      cell.append(label, input, button, readout);
      row.append(cell);
    }
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "clear";
    clear.textContent = "Clear";
    clear.setAttribute("aria-label", `Clear ${target.text} marks`);
    clear.addEventListener("click", () => {
      clearError();
      for (const { input, readout } of Object.values(inputs)) {
        input.value = "";
        edgeReadout(input, readout);
      }
      changed();
    });
    row.append(clear, error);
    rows.push({ id: target.id, error, ...inputs });
    document.querySelector("#mark-rows").append(row);
  }
}
function viewEnd() {
  return Math.min(
    context.durationSeconds,
    viewStart + context.durationSeconds / Number(zoom.value),
  );
}
function drawWaveform() {
  if (!context) return;
  const width = canvas.clientWidth,
    height = 170,
    ratio = devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const painter = canvas.getContext("2d");
  painter.scale(ratio, ratio);
  const left = 12,
    right = width - 12,
    top = 12,
    bottom = 130;
  const x = (seconds) => left + ((seconds - viewStart) / (viewEnd() - viewStart)) * (right - left);
  const middle = (top + bottom) / 2;
  const amplitude = Math.max(context.waveform.peak, 1e-12);
  painter.strokeStyle = "#dce4ed";
  painter.beginPath();
  painter.moveTo(left, middle);
  painter.lineTo(right, middle);
  painter.stroke();
  painter.strokeStyle = "#456e9e";
  painter.beginPath();
  for (const bin of context.waveform.bins) {
    if (bin.endSeconds < viewStart || bin.startSeconds > viewEnd()) continue;
    const center = x(
      (Math.max(bin.startSeconds, viewStart) + Math.min(bin.endSeconds, viewEnd())) / 2,
    );
    painter.moveTo(center, middle - ((bin.max / amplitude) * (bottom - top)) / 2);
    painter.lineTo(center, middle - ((bin.min / amplitude) * (bottom - top)) / 2);
  }
  painter.stroke();
  painter.fillStyle = "#526175";
  painter.font = "14px system-ui";
  for (let i = 0; i <= 4; i++) {
    const seconds = viewStart + ((viewEnd() - viewStart) * i) / 4;
    painter.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
    painter.fillText(clipTime(seconds), x(seconds), 151);
  }
  painter.textAlign = "center";
  painter.fillText("Clip seconds", width / 2, 168);
  if (audio.currentTime >= viewStart && audio.currentTime <= viewEnd()) {
    painter.strokeStyle = "#a64430";
    painter.beginPath();
    painter.moveTo(x(audio.currentTime), top);
    painter.lineTo(x(audio.currentTime), bottom);
    painter.stroke();
  }
}
function followPlayhead() {
  if (!context) return;
  const span = context.durationSeconds / Number(zoom.value);
  if (audio.currentTime < viewStart || audio.currentTime > viewEnd())
    viewStart = Math.max(0, Math.min(context.durationSeconds - span, audio.currentTime - span / 2));
  document.querySelector("#clip-clock").textContent = `${clipTime(audio.currentTime)} in this clip`;
  document.querySelector("#source-clock").textContent = sourceTime(audio.currentTime);
  drawWaveform();
}
function pointerTime(event) {
  const box = canvas.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (event.clientX - box.left - 12) / (box.width - 24)));
  return viewStart + fraction * (viewEnd() - viewStart);
}
audio.addEventListener("timeupdate", followPlayhead);
audio.addEventListener("seeked", followPlayhead);
zoom.addEventListener("input", () => {
  if (!context) return;
  const span = context.durationSeconds / Number(zoom.value);
  viewStart = Math.max(0, Math.min(context.durationSeconds - span, audio.currentTime - span / 2));
  document.querySelector("#zoom-value").textContent = `${zoom.value}×`;
  drawWaveform();
});
canvas.addEventListener("pointermove", (event) => {
  if (!context) return;
  const seconds = pointerTime(event);
  document.querySelector("#hover-time").textContent =
    `${clipTime(seconds)} in clip · source ${sourceTime(seconds)}`;
});
canvas.addEventListener("click", (event) => {
  if (!context || !audioReady) return;
  audio.currentTime = pointerTime(event);
  followPlayhead();
});
window.addEventListener("resize", drawWaveform);
confirmed.addEventListener("change", saveMode);
document.querySelector("#notes").addEventListener("input", () => message("Unsaved notes."));
document.querySelector("#marks-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!context || !audioReady || saving) return;
  const marks = rows.map((row) => ({
    id: row.id,
    startSeconds: row.start.input.value === "" ? null : Number(row.start.input.value),
    endSeconds: row.end.input.value === "" ? null : Number(row.end.input.value),
  }));
  const reversed = marks.find(
    (mark) =>
      mark.startSeconds !== null &&
      mark.endSeconds !== null &&
      mark.startSeconds >= mark.endSeconds,
  );
  if (reversed) {
    const row = rows.find((value) => value.id === reversed.id);
    row.end.input.setAttribute("aria-invalid", "true");
    row.error.textContent = "End must be after start. Correct this row or clear an uncertain edge.";
    row.error.hidden = false;
    message("An end must be after its start. Correct that row or clear an uncertain edge.", true);
    return;
  }
  const wasConfirmed = confirmed.checked;
  saving = true;
  fields.disabled = true;
  try {
    const response = await fetch("/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        binding: context.binding,
        marks,
        confirmed: wasConfirmed,
        notes: document.querySelector("#notes").value,
      }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error?.message ?? result.error ?? "The marks could not be saved.");
    const marked = marks.reduce(
      (count, mark) =>
        count + Number(mark.startSeconds !== null) + Number(mark.endSeconds !== null),
      0,
    );
    message(
      `${wasConfirmed ? "Listening marks" : "Draft"} saved: ${marked} of ${marks.length * 2} edges marked. Blank edges remain unknown.\n${result.savedPath}`,
    );
  } catch (error) {
    message(`Save failed. Your inputs are still here. ${error.message}`, true);
  } finally {
    saving = false;
    fields.disabled = !audioReady;
  }
});
try {
  const response = await fetch("/context.json");
  if (!response.ok) throw new Error("The original sentence context could not be loaded.");
  context = await response.json();
  document.querySelector("#sentence-text").textContent = context.text;
  document.querySelector("#provenance").textContent =
    `Original recording interval: ${sourceTime(0)} to ${sourceTime(context.durationSeconds)}. The waveform helps you navigate; it does not supply word boundaries.`;
  buildRows();
  followPlayhead();
  save.disabled = false;
  message("No marks yet. Listen first; save uncertain work as a draft.");
  await loadAudio();
} catch (error) {
  audioUnavailable();
  message(error.message, true);
}
