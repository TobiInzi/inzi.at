export function applyPalette(palette) {
  const root = document.documentElement;

  root.style.setProperty("--page-bg", palette.pageBg);
  root.style.setProperty("--main-color", palette.mainColor);
  root.style.setProperty("--text-on-main", palette.textOnMain);
  root.dataset.palette = palette.name;
}

export function readPalette() {
  const styles = getComputedStyle(document.documentElement);

  return {
    pageBg: styles.getPropertyValue("--page-bg").trim(),
    mainColor: styles.getPropertyValue("--main-color").trim(),
    textOnMain: styles.getPropertyValue("--text-on-main").trim(),
  };
}
