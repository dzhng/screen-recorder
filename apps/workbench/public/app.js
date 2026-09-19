const token = document.querySelector("#token");
function changeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const context = token.getContext("2d");
  context.fillStyle = "#173f3c";
  context.fillRect(0, 0, 420, 120);
  context.font = "bold 52px monospace";
  context.fillStyle = "#f4e3a6";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText([...bytes].map((value) => alphabet[value % alphabet.length]).join(""), 210, 62);
}
changeToken();
document.querySelector("#change-token").addEventListener("click", changeToken);
const products = document.querySelector("#products");
const submenu = document.querySelector("#submenu");
function showMenu(visible) {
  submenu.hidden = !visible;
  products.setAttribute("aria-expanded", String(visible));
}
products.addEventListener("pointerenter", () => showMenu(true));
products.addEventListener("click", () => showMenu(true));
// Deliberately close on leaving the trigger: the gap makes this bug reproducible.
products.addEventListener("pointerleave", () => showMenu(false));
const motion = document.querySelector("#motion");
motion.addEventListener("click", () => {
  const running = document.querySelector("#target").classList.toggle("running");
  motion.textContent = running ? "Reset motion" : "Start motion";
  motion.setAttribute("aria-pressed", String(running));
});
let audio;
let activeTones = 0;
for (const button of document.querySelectorAll("[data-tone]"))
  button.addEventListener("click", async () => {
    const status = document.querySelector("#audio-status");
    try {
      audio ??= new AudioContext();
      await audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = Number(button.dataset.tone);
      gain.gain.setValueAtTime(0, audio.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, audio.currentTime + 0.015);
      gain.gain.setValueAtTime(0.08, audio.currentTime + 0.45);
      gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.5);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.52);
      activeTones++;
      status.textContent = "Playing";
      oscillator.addEventListener("ended", () => {
        activeTones--;
        status.textContent = activeTones ? "Playing" : "Silent";
        oscillator.disconnect();
        gain.disconnect();
      });
    } catch {
      status.textContent = "Audio unavailable in this browser";
    }
  });

/**
 * A clapper: one instant that is both visible and audible, repeated, so a recording of this page
 * can be checked for audio drifting away from picture. The click is scheduled on the audio clock
 * and the flash is painted on the first frame at or after that same moment, so the two are emitted
 * within one frame of each other. What a measurement reads from a take is not that offset — a
 * browser's own output latency is in it — but whether the offset stays the same from the first
 * clap to the last.
 */
const clapper = document.querySelector("#clapper");
const bar = document.querySelector("#clap-bar");
const clapCount = document.querySelector("#clap-count");
const clapNext = document.querySelector("#clap-next");
const clapEverySeconds = 15;
let clapping;
let claps = 0;

function click(at) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  // Short and sharp: an onset a measurement can place to the millisecond, quiet enough to record
  // beside a voice.
  oscillator.frequency.value = 1_000;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.2, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(at);
  oscillator.stop(at + 0.08);
  oscillator.addEventListener("ended", () => {
    oscillator.disconnect();
    gain.disconnect();
  });
}

clapper.addEventListener("click", async () => {
  if (clapping) {
    cancelAnimationFrame(clapping.frame);
    clapping = undefined;
    bar.classList.remove("lit");
    clapper.textContent = "Start clapper";
    clapper.setAttribute("aria-pressed", "false");
    clapNext.textContent = "idle";
    return;
  }
  try {
    audio ??= new AudioContext();
    await audio.resume();
  } catch {
    clapNext.textContent = "audio unavailable in this browser";
    return;
  }
  clapper.textContent = "Stop clapper";
  clapper.setAttribute("aria-pressed", "true");
  // The first clap is a moment away, so a recording started now catches it whole.
  let next = audio.currentTime + 3;
  click(next);
  let lit = 0;
  const tick = () => {
    const now = audio.currentTime;
    if (lit && now >= lit) {
      bar.classList.remove("lit");
      lit = 0;
    }
    if (now >= next) {
      bar.classList.add("lit");
      lit = now + 0.1;
      claps += 1;
      clapCount.textContent = String(claps);
      // A browser stops painting a hidden tab, so a page switched away from and back again is
      // behind by however long it was away. The missed claps are skipped rather than fired off
      // one per frame: a burst of clicks is neither a clapper nor pleasant to sit through.
      while (now >= next) next += clapEverySeconds;
      click(next);
    }
    clapNext.textContent = `next in ${Math.max(0, next - now).toFixed(0)}s`;
    clapping.frame = requestAnimationFrame(tick);
  };
  clapping = { frame: requestAnimationFrame(tick) };
});

// Painting stops while a tab is hidden, so a clapper only claps while somebody can see it. Saying
// so is the difference between a take with a gap in its claps and one whose page was never there.
document.addEventListener("visibilitychange", () => {
  if (!clapping) return;
  clapNext.textContent = document.hidden ? "paused while this tab is hidden" : "counting again";
});
