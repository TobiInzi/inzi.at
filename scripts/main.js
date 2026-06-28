// Accent type selector: pick a type to tint the site, click it again to clear.
const STORAGE_KEY = "tobiinzi:accent";

const root = document.documentElement;
const palette = document.querySelector(".palette");
const buttons = [...palette.querySelectorAll(".type")];

function applyAccent(color) {
  if (color) {
    root.style.setProperty("--accent", color);
  } else {
    root.style.removeProperty("--accent");
  }
}

function setActive(active) {
  for (const button of buttons) {
    const isActive = button === active;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function select(button) {
  setActive(button);
  applyAccent(button.dataset.color);
  localStorage.setItem(STORAGE_KEY, button.dataset.color);
}

function clear() {
  setActive(null);
  applyAccent(null);
  localStorage.removeItem(STORAGE_KEY);
}

// Restore a previously chosen accent.
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  const button = buttons.find((b) => b.dataset.color === saved);
  if (button) select(button);
}

palette.addEventListener("click", (event) => {
  const button = event.target.closest(".type");
  if (!button) return;

  if (button.classList.contains("is-active")) {
    clear();
  } else {
    select(button);
  }
});
