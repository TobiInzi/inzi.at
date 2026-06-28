const NON_BREAKING_SPACE = "\u00a0";

export function renderTitleText(container, text) {
  container.textContent = "";

  for (const character of text) {
    const letter = document.createElement("span");
    letter.className = "main-title-letter";
    letter.textContent = character === " " ? NON_BREAKING_SPACE : character;

    if (character === " ") {
      letter.classList.add("is-space");
    }

    container.append(letter);
  }
}
