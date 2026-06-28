export function renderTitleText(container, text) {
  container.textContent = "";

  for (const character of text) {
    const letter = document.createElement("span");
    letter.className = "main-title-letter";
    letter.textContent = character === " " ? "\u00a0" : character;

    if (character === " ") {
      letter.classList.add("is-space");
    }

    container.append(letter);
  }
}
