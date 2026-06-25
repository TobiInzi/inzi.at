const content = {
  highlights: [
    {
      date: "2026",
      text: "Joined <strong>Example Labs</strong> as Founding Engineer."
    },
    {
      date: "2026",
      text: "Graduated with a <strong>Bachelor of Science in Computer Science</strong> from Example University."
    },
    {
      date: "2025",
      text: "Founded <strong>Example Student Society</strong> to foster academic exchange and community."
    },
    {
      date: "2023-24",
      text: "Teaching Assistant for <strong>Software Engineering</strong> and <strong>Computer Architecture</strong>."
    },
    {
      date: "2022",
      text: "Worked at <strong>Example Informatik</strong> as Software Engineer Working Student."
    },
    {
      date: "2022",
      text: "Started Computer Science studies at <strong>Example University</strong>."
    }
  ],
  experience: [
    {
      title: "Founding Engineer",
      company: "Example Labs",
      date: "2026 - Present",
      description: [
        "Building early product foundations across frontend, backend, and infrastructure.",
        "Working closely with users to turn ambiguous problems into focused software."
      ]
    },
    {
      title: "Software Engineering Intern",
      company: "Example Company",
      date: "2025",
      description: [
        "Contributed to production services, internal tools, and interface improvements.",
        "Collaborated with senior engineers on reliable, maintainable feature delivery."
      ]
    },
    {
      title: "Teaching Assistant",
      company: "Example University",
      date: "2023 - 2024",
      description: [
        "Supported courses in software engineering and computer architecture.",
        "Led exercises, reviewed submissions, and helped students build stronger fundamentals."
      ]
    }
  ],
  work: [
    {
      title: "Quiet Notes",
      description: "A minimal writing space for structured technical notes and daily research logs.",
      stack: ["TypeScript", "SQLite", "CSS"],
      link: "#"
    },
    {
      title: "Signal Board",
      description: "A small dashboard for tracking product signals, experiments, and engineering decisions.",
      stack: ["React", "Node.js", "Postgres"],
      link: "#"
    },
    {
      title: "Local Index",
      description: "A personal search interface for projects, papers, snippets, and long-running ideas.",
      stack: ["Python", "FastAPI", "Embeddings"],
      link: "#"
    }
  ]
};

const tabs = Array.from(document.querySelectorAll("[role='tab']"));
const panels = Array.from(document.querySelectorAll("[role='tabpanel']"));
const themeToggle = document.querySelector(".theme-toggle");
const html = document.documentElement;

function renderHighlights() {
  const list = document.querySelector("[data-content='highlights']");

  list.innerHTML = content.highlights
    .map((item) => `
      <li class="timeline-item">
        <time class="timeline-date">${item.date}</time>
        <p class="timeline-text">${item.text}</p>
      </li>
    `)
    .join("");
}

function renderExperience() {
  const list = document.querySelector("[data-content='experience']");

  list.innerHTML = content.experience
    .map((item) => `
      <article class="entry">
        <div class="entry-header">
          <h2 class="entry-title">${item.title} - ${item.company}</h2>
          <span class="entry-meta">${item.date}</span>
        </div>
        ${item.description.map((line) => `<p class="entry-description">${line}</p>`).join("")}
      </article>
    `)
    .join("");
}

function renderWork() {
  const list = document.querySelector("[data-content='work']");

  list.innerHTML = content.work
    .map((item) => `
      <article class="entry">
        <div class="entry-header">
          <h2 class="project-title">${item.title}</h2>
          <span class="project-meta">Project</span>
        </div>
        <p class="project-description">${item.description}</p>
        <ul class="project-stack" aria-label="Tech stack">
          ${item.stack.map((tech) => `<li>${tech}</li>`).join("")}
        </ul>
        <a class="project-link" href="${item.link}">View project</a>
      </article>
    `)
    .join("");
}

function activateTab(tabName) {
  tabs.forEach((tab) => {
    const isSelected = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
  });

  panels.forEach((panel) => {
    const isSelected = panel.id === `panel-${tabName}`;
    panel.classList.toggle("is-active", isSelected);
    panel.hidden = !isSelected;
  });
}

function updateThemeToggle() {
  const isLight = html.dataset.theme === "light";
  themeToggle.setAttribute("aria-pressed", String(isLight));
  themeToggle.setAttribute(
    "aria-label",
    isLight ? "Switch to dark theme" : "Switch to light theme"
  );
  document.querySelector("meta[name='theme-color']").setAttribute(
    "content",
    isLight ? "#f4f1ea" : "#11100e"
  );
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  tab.addEventListener("keydown", (event) => {
    const currentIndex = tabs.indexOf(tab);
    const nextKey = event.key === "ArrowRight";
    const previousKey = event.key === "ArrowLeft";

    if (!nextKey && !previousKey) return;

    event.preventDefault();
    const direction = nextKey ? 1 : -1;
    const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
    nextTab.focus();
    activateTab(nextTab.dataset.tab);
  });
});

themeToggle.addEventListener("click", () => {
  const nextTheme = html.dataset.theme === "light" ? "dark" : "light";
  html.dataset.theme = nextTheme;
  try {
    localStorage.setItem("portfolio-theme", nextTheme);
  } catch {
    html.dataset.theme = nextTheme;
  }
  updateThemeToggle();
});

renderHighlights();
renderExperience();
renderWork();
updateThemeToggle();
