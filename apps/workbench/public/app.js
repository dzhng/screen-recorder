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
