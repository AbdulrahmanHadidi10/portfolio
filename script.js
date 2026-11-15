// ===== Translations =====
const I18N = {
  en: {
    "meta.title": "Abdulrahman Hadidi — Portfolio",
    "logo": "Abdulrahman",
    "theme.light": "Light mode",
    "theme.dark": "Night mode",
    "nav.about": "About",
    "nav.skills": "Skills",
    "nav.projects": "Projects",
    "nav.education": "Education",
    "nav.contact": "Contact",
    "hero.eyebrow": "Computer Science · Jeddah, Saudi Arabia",
    "hero.l1": "Abdulrahman",
    "hero.l2": "Fawzi Hadidi<em>.</em>",
    "hero.sub": "Building clean, thoughtful software across the frontend and backend.",
    "hero.cta": "See my work <i>↓</i>",
    "about.label": "01 — About",
    "about.text": "Fourth-year Computer Science student at King Abdulaziz University with knowledge of backend and frontend development — and a solid grounding in OOP, databases, data structures, and algorithms.",
    "about.langsLabel": "Languages",
    "about.langs": "Arabic — Native<br>English — Good Working Proficiency",
    "about.certLabel": "Certification",
    "about.cert": "Python Courses<br>Coursera",
    "skills.label": "02 — Skills",
    "skills.prog": "Programming",
    "skills.front": "Frontend",
    "skills.core": "Core Concepts",
    "skills.coreMeta": "OOP · Data Structures · Algorithms",
    "skills.db": "Databases",
    "skills.dbMeta": "SQL · Database Fundamentals",
    "projects.label": "03 — Projects",
    "projects.title": "Selected work",
    "projects.soonTitle": "More coming soon",
    "projects.soonText": "New projects are on the way — follow along on GitHub.",
    "edu.label": "04 — Education",
    "edu.degree": "Bachelor of Computer Science",
    "edu.degreeMeta": "King Abdulaziz University · Fourth-Year Student",
    "edu.python": "Python Courses",
    "edu.pythonMeta": "Coursera · Certification",
    "contact.label": "05 — Contact",
    "contact.title": "Let's work<br>together.",
    "contact.phone": "Phone",
    "contact.linkedinName": "Abdulrahman Hadidi",
    "footer.name": "Abdulrahman Fawzi Hadidi",
    "footer.top": "Back to top ↑",
    "footer.dash": "Dashboard"
  },
  ar: {
    "meta.title": "عبدالرحمن حديدي — معرض الأعمال",
    "logo": "عبدالرحمن",
    "theme.light": "الوضع النهاري",
    "theme.dark": "الوضع الليلي",
    "nav.about": "نبذة",
    "nav.skills": "المهارات",
    "nav.projects": "المشاريع",
    "nav.education": "التعليم",
    "nav.contact": "تواصل",
    "hero.eyebrow": "علوم الحاسب · جدة، المملكة العربية السعودية",
    "hero.l1": "عبدالرحمن",
    "hero.l2": "فوزي حديدي<em>.</em>",
    "hero.sub": "أبني برمجيات نظيفة ومدروسة في الواجهات الأمامية والخلفية.",
    "hero.cta": "شاهد أعمالي <i>↓</i>",
    "about.label": "01 — نبذة",
    "about.text": "طالب في السنة الرابعة بتخصص علوم الحاسب في جامعة الملك عبدالعزيز، لدي معرفة بتطوير الواجهات الأمامية والخلفية — وأساس متين في البرمجة الكائنية وقواعد البيانات وهياكل البيانات والخوارزميات.",
    "about.langsLabel": "اللغات",
    "about.langs": "العربية — اللغة الأم<br>الإنجليزية — إتقان جيد",
    "about.certLabel": "الشهادات",
    "about.cert": "دورات بايثون<br>Coursera",
    "skills.label": "02 — المهارات",
    "skills.prog": "البرمجة",
    "skills.front": "الواجهات الأمامية",
    "skills.core": "المفاهيم الأساسية",
    "skills.coreMeta": "البرمجة الكائنية · هياكل البيانات · الخوارزميات",
    "skills.db": "قواعد البيانات",
    "skills.dbMeta": "SQL · أساسيات قواعد البيانات",
    "projects.label": "03 — المشاريع",
    "projects.title": "أعمال مختارة",
    "projects.soonTitle": "المزيد قريبًا",
    "projects.soonText": "مشاريع جديدة في الطريق — تابعني على GitHub.",
    "edu.label": "04 — التعليم",
    "edu.degree": "بكالوريوس علوم الحاسب",
    "edu.degreeMeta": "جامعة الملك عبدالعزيز · طالب في السنة الرابعة",
    "edu.python": "دورات بايثون",
    "edu.pythonMeta": "Coursera · شهادة",
    "contact.label": "05 — تواصل",
    "contact.title": "لنعمل<br>معًا.",
    "contact.phone": "الجوال",
    "contact.linkedinName": "عبدالرحمن حديدي",
    "footer.name": "عبدالرحمن فوزي حديدي",
    "footer.top": "العودة للأعلى ↑",
    "footer.dash": "لوحة التحكم"
  }
};

const root = document.documentElement;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
};

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// ===== Projects (from projects.js) =====
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => {
  u = String(u || "").trim();
  return /^https?:\/\//i.test(u) || /^[\w\-./]+$/.test(u) ? u : "";
};

function renderProjects(lang, reveal) {
  const grid = document.getElementById("projects-grid");
  const t = I18N[lang];
  const pick = (o) => (o && (o[lang] || o.en || o.ar)) || "";
  const list = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  const cls = reveal ? "reveal visible" : "reveal";

  const cards = list.map((p, i) => {
    const link = safeUrl(p.link);
    const tag = link ? "a" : "div";
    const attrs = link ? ` href="${esc(link)}" target="_blank" rel="noopener"` : "";
    const img = safeUrl(p.image);
    const thumb = img
      ? `<img src="${esc(img)}" alt="" loading="lazy">`
      : `<div class="thumb-inner"><span class="thumb-code">&lt;/&gt;</span></div>`;
    const tags = (p.tags || []).map((x) => `<li>${esc(x)}</li>`).join("");
    return `
      <${tag} class="project-card${i === 0 ? " featured" : ""} ${cls}"${attrs}>
        <div class="project-thumb">${thumb}</div>
        <div class="project-info">
          <div>
            <h3>${esc(pick(p.title))}</h3>
            <p>${esc(pick(p.description))}</p>
            ${tags ? `<ul class="tags">${tags}</ul>` : ""}
          </div>
          ${link ? `<span class="circle-arrow">↗</span>` : ""}
        </div>
      </${tag}>`;
  });

  cards.push(`
    <a class="project-card project-soon ${cls}" href="https://github.com/AbdulrahmanHadidi10" target="_blank" rel="noopener">
      <div class="project-info">
        <div>
          <h3>${t["projects.soonTitle"]}</h3>
          <p>${t["projects.soonText"]}</p>
        </div>
        <span class="circle-arrow">↗</span>
      </div>
    </a>`);

  grid.innerHTML = cards.join("");
}

// ===== Language selector =====
const langButtons = document.querySelectorAll("[data-lang-value]");
function applyLang(lang, save) {
  const t = I18N[lang] || I18N.en;
  root.setAttribute("lang", lang);
  root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  document.title = t["meta.title"];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const v = t[el.dataset.i18n];
    if (v != null) el.innerHTML = v;
  });
  document.querySelectorAll("[data-i18n-label]").forEach((el) => {
    const v = t[el.dataset.i18nLabel];
    if (v != null) { el.setAttribute("aria-label", v); el.title = v; }
  });
  langButtons.forEach((b) => b.setAttribute("aria-checked", b.dataset.langValue === lang));
  renderProjects(lang, save);
  if (save) store.set("lang", lang);
}
applyLang(root.getAttribute("lang") === "ar" ? "ar" : "en", false);
langButtons.forEach((b) => b.addEventListener("click", () => {
  if (root.getAttribute("lang") !== b.dataset.langValue) applyLang(b.dataset.langValue, true);
}));

// ===== Theme selector (light / night) =====
const themeButtons = document.querySelectorAll("[data-theme-value]");
const applyTheme = (theme, save) => {
  root.setAttribute("data-theme", theme);
  themeButtons.forEach((b) => b.setAttribute("aria-checked", b.dataset.themeValue === theme));
  if (save) store.set("theme", theme);
};
applyTheme(root.getAttribute("data-theme") || "light", false);
themeButtons.forEach((b) => b.addEventListener("click", () => applyTheme(b.dataset.themeValue, true)));

// Follow the device setting until the visitor picks one
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!store.get("theme")) applyTheme(e.matches ? "dark" : "light", false);
});

// ===== Hero line-by-line reveal on load =====
document.querySelectorAll(".hero .split-line > span").forEach((el, i) => {
  el.style.transitionDelay = `${0.15 + i * 0.12}s`;
});
window.addEventListener("load", () => document.body.classList.add("loaded"));

// ===== Header: hide on scroll down, show on scroll up =====
const nav = document.querySelector(".nav");
let lastY = window.scrollY;
window.addEventListener(
  "scroll",
  () => {
    const y = window.scrollY;
    nav.classList.toggle("scrolled", y > 10);
    if (!nav.classList.contains("open")) {
      nav.classList.toggle("hidden", y > lastY && y > 120);
    }
    lastY = y;
  },
  { passive: true }
);

// ===== Mobile menu =====
const toggle = document.querySelector(".nav-toggle");
const setMenu = (open) => {
  nav.classList.toggle("open", open);
  if (open) nav.classList.remove("hidden");
  toggle.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
};
toggle.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
document.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

// ===== Scroll reveal with stagger for siblings =====
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      el.style.transitionDelay = `${Math.max(0, siblings.indexOf(el)) * 0.08}s`;
      el.classList.add("visible");
      observer.unobserve(el);
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
document.querySelectorAll(".reveal:not(.visible)").forEach((el) => observer.observe(el));
