export function chooseStartPage(pages) {
  const index = Math.floor(Math.random() * pages.length);

  return pages[index];
}

export function applyStartPage(page) {
  const root = document.documentElement;

  root.style.setProperty("--page-bg", page.pageBg);
  root.style.setProperty("--main-color", page.mainColor);
  root.style.setProperty("--text-on-main", page.textOnMain);
  root.dataset.startPage = page.name;
}

export function readTheme() {
  const styles = getComputedStyle(document.documentElement);

  return {
    pageBg: styles.getPropertyValue("--page-bg").trim(),
    mainColor: styles.getPropertyValue("--main-color").trim(),
  };
}
