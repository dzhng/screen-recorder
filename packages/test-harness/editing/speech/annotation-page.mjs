import { secondsToSourceUs } from "./annotation-time.mjs";

const audio = document.querySelector("#audio");
const canvas = document.querySelector("#waveform");
const next = document.querySelector("#next");
const back = document.querySelector("#back");
const skip = document.querySelector("#skip");
const selection = document.querySelector("#selection");
const status = document.querySelector("#status");
let context;
let steps = [];
let marks = [];
let stepIndex = 0;
let selected = null;
let viewStart = 0;
let zoom = 1;
let audioReady = false;
let audioUrl;
let previewEnd = null;
let previewId = 0;
let saving = false;
let finished = false;
let saveFailed = false;

const clipTime = (seconds) => `${seconds.toFixed(3)} s`;
const sourceTime = (seconds) =>
  `${(secondsToSourceUs(seconds, context.binding) / 1000000).toFixed(6)} s`;
function message(text, error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
}
function invalidEnd() {
  const step = steps[stepIndex];
  const start = marks.find((mark) => mark.id === step?.target.id)?.startSeconds;
  return step?.edge === "end" && selected !== null && start !== null && selected <= start;
}
function updateControls() {
  next.disabled =
    !audioReady || (!saveFailed && (selected === null || invalidEnd())) || saving || finished;
  skip.disabled = !audioReady || saving || finished;
  back.disabled = !audioReady || stepIndex === 0 || saving || finished;
}
function audioUnavailable() {
  audioReady = false;
  updateControls();
  document.querySelector("#audio-status").textContent =
    "The recording could not be loaded. Your selections are still here.";
  document.querySelector("#reload-audio").hidden = false;
}
async function loadAudio() {
  stopPreview();
  audioReady = false;
  updateControls();
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
  document.querySelector("#audio-status").textContent =
    `${audio.duration.toFixed(2)} seconds loaded. Click the waveform to hear a preview.`;
  showStep();
});
document.querySelector("#reload-audio").addEventListener("click", () => {
  if (context) loadAudio();
  else window.location.reload();
});
function showStep() {
  const step = steps[stepIndex];
  document.querySelector("#progress").textContent = `Boundary ${stepIndex + 1} of ${steps.length}`;
  document.querySelector("#step-title").textContent =
    `Where does ${step.target.id === "sentence" ? "the whole sentence" : `“${step.target.text}”`} ${step.edge === "start" ? "begin" : "finish"}?`;
  document.querySelector("#instruction").textContent =
    `Click where ${step.edge === "start" ? "it begins" : "it finishes"}${step.target.hint ? ` (${step.target.hint})` : ""}. Listen to the preview, then press Next to confirm.`;
  selection.textContent =
    selected === null
      ? "Click the waveform to choose this boundary."
      : `Selected ${clipTime(selected)}`;
  if (invalidEnd()) selection.textContent += " · Choose an ending after the marked start.";
  updateControls();
  drawWaveform();
}
function viewEnd() {
  return Math.min(context.durationSeconds, viewStart + context.durationSeconds / zoom);
}
function drawWaveform() {
  if (!context) return;
  const width = canvas.clientWidth,
    height = canvas.clientHeight,
    ratio = devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const painter = canvas.getContext("2d");
  painter.scale(ratio, ratio);
  const left = 12,
    right = width - 12,
    top = 30,
    bottom = height - 40;
  const x = (seconds) => left + ((seconds - viewStart) / (viewEnd() - viewStart)) * (right - left);
  const middle = (top + bottom) / 2;
  const amplitude = Math.max(context.waveform.peak, 1e-12);
  const targetMark = marks.find((mark) => mark.id === steps[stepIndex]?.target.id);
  if (targetMark && targetMark.startSeconds !== null && targetMark.endSeconds !== null) {
    painter.fillStyle = "#e7effb";
    painter.fillRect(
      x(targetMark.startSeconds),
      top,
      x(targetMark.endSeconds) - x(targetMark.startSeconds),
      bottom - top,
    );
  }
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
  painter.font = "13px system-ui";
  const ticks = width < 500 ? 2 : 4;
  for (let i = 0; i <= ticks; i++) {
    const seconds = viewStart + ((viewEnd() - viewStart) * i) / ticks;
    painter.textAlign = i === 0 ? "left" : i === ticks ? "right" : "center";
    painter.fillText(clipTime(seconds), x(seconds), height - 12);
  }
  function line(seconds, color, label) {
    if (seconds === null || seconds < viewStart || seconds > viewEnd()) return;
    painter.strokeStyle = color;
    painter.lineWidth = 2;
    painter.beginPath();
    painter.moveTo(x(seconds), top);
    painter.lineTo(x(seconds), bottom);
    painter.stroke();
    if (label) {
      painter.fillStyle = color;
      painter.textAlign = seconds < (viewStart + viewEnd()) / 2 ? "left" : "right";
      painter.fillText(label, x(seconds), 19);
    }
  }
  line(targetMark?.startSeconds ?? null, "#647b9c", null);
  line(targetMark?.endSeconds ?? null, "#647b9c", null);
  line(audio.currentTime, "#b45a38", null);
  line(selected, "#245da5", "Selected");
}
async function preview() {
  const id = ++previewId;
  audio.pause();
  audio.currentTime = selected;
  previewEnd = Math.min(context.durationSeconds, selected + 0.8);
  try {
    await audio.play();
  } catch (error) {
    if (id !== previewId || error.name === "AbortError") return;
    previewEnd = null;
    document.querySelector("#audio-status").textContent =
      "Preview could not start. Use the recording’s Play button to listen.";
  }
}
function choose(seconds, listen = true) {
  if (!audioReady || saving || finished) return;
  saveFailed = false;
  selected = Math.round(Math.max(0, Math.min(context.durationSeconds, seconds)) * 1000) / 1000;
  showStep();
  if (listen) preview();
}
canvas.addEventListener("click", (event) => {
  const box = canvas.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (event.clientX - box.left - 12) / (box.width - 24)));
  if (context) choose(viewStart + fraction * (viewEnd() - viewStart));
});
canvas.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    choose((selected ?? audio.currentTime) + (event.key === "ArrowLeft" ? -0.01 : 0.01), false);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    choose(selected ?? audio.currentTime);
  }
});
audio.addEventListener("timeupdate", () => {
  if (previewEnd !== null && audio.currentTime >= previewEnd) {
    audio.pause();
    previewEnd = null;
  }
  drawWaveform();
});
function stopPreview() {
  previewId++;
  audio.pause();
  previewEnd = null;
}
function setZoom(value) {
  zoom = Math.max(1, Math.min(16, value));
  if (context)
    viewStart = Math.max(
      0,
      Math.min(
        context.durationSeconds - context.durationSeconds / zoom,
        (selected ?? audio.currentTime) - context.durationSeconds / zoom / 2,
      ),
    );
  document.querySelector("#zoom-value").textContent = `${zoom}×`;
  drawWaveform();
}
document.querySelector("#zoom-in").addEventListener("click", () => setZoom(zoom * 2));
document.querySelector("#zoom-out").addEventListener("click", () => setZoom(zoom / 2));
window.addEventListener("resize", drawWaveform);
async function saveMarks() {
  saving = true;
  saveFailed = false;
  updateControls();
  message("Saving your confirmed selections…");
  try {
    const response = await fetch("/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        binding: context.binding,
        marks,
        confirmed: true,
        notes:
          "Guided waveform marking: each selected boundary confirmed with Next; skipped edges unknown." +
          (context.targets.some((target) => target.id === "opening-um")
            ? " Opening um reported by the listener."
            : ""),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not save marks");
    finished = true;
    selected = null;
    drawWaveform();
    document.querySelector("h1").textContent = "Your marks are saved";
    document.querySelector("#progress").textContent = "Complete";
    document.querySelector("#step-title").textContent = "Your selections are saved";
    document.querySelector("#instruction").textContent = "Thank you. Skipped edges remain unknown.";
    selection.textContent = "Confirmed selections saved. Skipped boundaries remain unknown.";
    document.querySelector("#audio-status").textContent =
      "Use Play to hear the original recording again.";
    document.querySelector(".navigation").hidden = true;
    canvas.setAttribute("aria-disabled", "true");
    document.querySelector("#complete").hidden = false;
    for (const mark of marks) {
      const item = document.createElement("li");
      item.textContent = `${context.targets.find((target) => target.id === mark.id).text}: ${mark.startSeconds === null ? "start unknown" : clipTime(mark.startSeconds)} → ${mark.endSeconds === null ? "end unknown" : clipTime(mark.endSeconds)}`;
      document.querySelector("#summary").append(item);
    }
    message(`Saved locally.\n${result.savedPath}`);
  } catch (error) {
    saveFailed = true;
    message(
      `Save failed. Your selections are still here. Press Next to try again. ${error.message}`,
      true,
    );
  } finally {
    saving = false;
    updateControls();
  }
}
async function advance(value) {
  if (!audioReady || saving || finished) return;
  stopPreview();
  const step = steps[stepIndex];
  marks.find((mark) => mark.id === step.target.id)[`${step.edge}Seconds`] = value;
  if (stepIndex === steps.length - 1) {
    await saveMarks();
    return;
  }
  stepIndex++;
  const newStep = steps[stepIndex];
  selected = marks.find((mark) => mark.id === newStep.target.id)[`${newStep.edge}Seconds`];
  message(
    stepIndex === steps.length - 1
      ? "Last boundary: Next confirms it and saves your marks."
      : "Next confirms this boundary. Skip if you cannot hear a clear edge.",
  );
  showStep();
}
next.addEventListener("click", () => {
  if (saveFailed) {
    saveMarks();
    return;
  }
  if (selected !== null && !invalidEnd()) advance(selected);
});
skip.addEventListener("click", () => advance(null));
back.addEventListener("click", () => {
  if (stepIndex === 0 || saving || finished) return;
  saveFailed = false;
  stopPreview();
  stepIndex--;
  const step = steps[stepIndex];
  selected = marks.find((mark) => mark.id === step.target.id)[`${step.edge}Seconds`];
  message("Click again to change this boundary, then Next to confirm.");
  showStep();
});
try {
  const response = await fetch("/context.json");
  if (!response.ok) throw new Error("The recording context could not be loaded.");
  context = await response.json();
  steps = context.targets.flatMap((target) => ["start", "end"].map((edge) => ({ target, edge })));
  marks = context.targets.map((target) => ({
    id: target.id,
    startSeconds: null,
    endSeconds: null,
  }));
  message(
    "Listen to the preview, then Next confirms your selected point. The last Next saves your marks.",
  );
  document.querySelector("#sentence-text").textContent =
    `${context.targets.some((target) => target.id === "opening-um") ? "You reported an opening “um”. Suggested remaining sentence:" : "Suggested transcript:"} ${context.text}`;
  document.querySelector("#provenance").textContent =
    `Original recording interval: ${sourceTime(0)} to ${sourceTime(context.durationSeconds)}. No boundary times are prefilled.`;
  await loadAudio();
} catch (error) {
  audioUnavailable();
  message(error.message, true);
}
