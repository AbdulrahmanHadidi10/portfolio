/*
  Projects dashboard
  ------------------
  - Settings (GitHub token, repo) are encrypted with your password (PBKDF2 + AES-GCM)
    and stored only in this browser. Without the password nothing can be decrypted.
  - "Publish" commits projects.js to your GitHub repo using the token.
  - Without a token (local mode), "Download projects.js" and replace the file in your folder.
*/

const VAULT_KEY = "portfolio-dashboard-vault";
const FILE_PATH = "projects.js";
const $ = (s) => document.querySelector(s);
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- helpers ----------
const toB64 = (bytes) => { let s = ""; new Uint8Array(bytes).forEach((b) => (s += String.fromCharCode(b))); return btoa(s); };
const fromB64 = (s) => Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0));
const utf8ToB64 = (str) => toB64(enc.encode(str));
const b64ToUtf8 = (b64) => dec.decode(fromB64(b64));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
const show = (id) => ["setup", "unlock", "app"].forEach((x) => ($("#" + x).hidden = x !== id));
const setMsg = (el, text, type = "err") => { el.textContent = text; el.className = "msg " + type; };

// ---------- encrypted vault ----------
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function saveVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  localStorage.setItem(VAULT_KEY, JSON.stringify({ v: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(cipher) }));
}
async function openVault(password) {
  const v = JSON.parse(localStorage.getItem(VAULT_KEY));
  const key = await deriveKey(password, fromB64(v.salt));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(v.iv) }, key, fromB64(v.data));
  return JSON.parse(dec.decode(plain));
}
const hasVault = () => { try { return !!localStorage.getItem(VAULT_KEY); } catch (e) { return false; } };

// ---------- GitHub API ----------
function gh(cfg, path, opts = {}) {
  return fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers || {})
    }
  });
}
async function checkRepo(cfg) {
  const r = await gh(cfg, "");
  if (r.status === 401) throw new Error("GitHub rejected the token. Check that it's copied correctly and not expired.");
  if (r.status === 404) throw new Error(`Repository ${cfg.owner}/${cfg.repo} not found, or the token can't access it.`);
  if (!r.ok) throw new Error(`GitHub error (${r.status}).`);
  const repo = await r.json();
  if (repo.permissions && !repo.permissions.push) throw new Error("This token can read the repo but not write to it.");
}

// ---------- projects file ----------
const serialize = (list) => `window.PROJECTS = ${JSON.stringify(list, null, 2)};\n`;
function parseProjects(text) {
  const start = text.indexOf("["), end = text.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  return JSON.parse(text.slice(start, end + 1));
}
const normalize = (p) => ({
  id: p.id || uid(),
  title: { en: p.title?.en || "", ar: p.title?.ar || "" },
  description: { en: p.description?.en || "", ar: p.description?.ar || "" },
  tags: Array.isArray(p.tags) ? p.tags : [],
  link: p.link || "",
  image: p.image || ""
});

// ---------- state ----------
let cfg = null;          // { token, owner, repo, branch }
let password = null;     // kept in memory only while unlocked (for re-encrypting)
let projects = [];
let fileSha = null;      // GitHub sha of projects.js
let editingId = null;
let dirty = false;

const isLive = () => !!(cfg && cfg.token);

async function loadProjects() {
  if (isLive()) {
    const r = await gh(cfg, `/contents/${FILE_PATH}?ref=${encodeURIComponent(cfg.branch)}`);
    if (r.status === 404) { fileSha = null; projects = []; }
    else if (!r.ok) throw new Error(`Couldn't load ${FILE_PATH} from GitHub (${r.status}).`);
    else {
      const file = await r.json();
      fileSha = file.sha;
      projects = parseProjects(b64ToUtf8(file.content)).map(normalize);
    }
  } else {
    projects = (Array.isArray(window.PROJECTS) ? window.PROJECTS : []).map(normalize);
  }
  setDirty(false);
  render();
}

function setDirty(v) {
  dirty = v;
  $("#publish-status").innerHTML = v
    ? `<span class="dirty-dot"></span>Unpublished changes`
    : isLive() ? "Everything is published." : "Local mode — download the file to save changes.";
}

// ---------- render ----------
function render() {
  const list = $("#plist");
  $("#count").textContent = projects.length ? `${projects.length}` : "";
  if (!projects.length) {
    list.innerHTML = `<p class="empty">No projects yet. Add your first one.</p>`;
    return;
  }
  list.innerHTML = projects.map((p, i) => `
    <article class="pitem${p.id === editingId ? " editing" : ""}" data-id="${esc(p.id)}">
      <div>
        <h3>${esc(p.title.en || p.title.ar)}</h3>
        ${p.title.ar ? `<p class="ar">${esc(p.title.ar)}</p>` : ""}
        ${p.tags.length ? `<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      </div>
      <div class="pitem-actions">
        <button class="icon-btn" data-act="up" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" data-act="down" title="Move down" ${i === projects.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn btn-sm" data-act="edit">Edit</button>
        <button class="btn btn-sm btn-danger" data-act="delete">Delete</button>
      </div>
    </article>`).join("");
}

// ---------- form ----------
const fields = {
  titleEn: $("#f-title-en"), titleAr: $("#f-title-ar"),
  descEn: $("#f-desc-en"), descAr: $("#f-desc-ar"),
  tags: $("#f-tags"), link: $("#f-link"), image: $("#f-image")
};

function resetForm() {
  editingId = null;
  $("#project-form").reset();
  $("#form-title").textContent = "Add a project";
  $("#save-btn").textContent = "Add project";
  $("#cancel-btn").hidden = true;
  render();
}

function editProject(id) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  fields.titleEn.value = p.title.en; fields.titleAr.value = p.title.ar;
  fields.descEn.value = p.description.en; fields.descAr.value = p.description.ar;
  fields.tags.value = p.tags.join(", "); fields.link.value = p.link; fields.image.value = p.image;
  $("#form-title").textContent = "Edit project";
  $("#save-btn").textContent = "Save changes";
  $("#cancel-btn").hidden = false;
  render();
  $("#project-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#project-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = normalize({
    id: editingId || uid(),
    title: { en: fields.titleEn.value.trim(), ar: fields.titleAr.value.trim() },
    description: { en: fields.descEn.value.trim(), ar: fields.descAr.value.trim() },
    tags: fields.tags.value.split(",").map((t) => t.trim()).filter(Boolean),
    link: fields.link.value.trim(),
    image: fields.image.value.trim()
  });
  if (editingId) projects = projects.map((p) => (p.id === editingId ? data : p));
  else projects.push(data);
  setDirty(true);
  resetForm();
});
$("#cancel-btn").addEventListener("click", resetForm);

$("#plist").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".pitem").dataset.id;
  const i = projects.findIndex((p) => p.id === id);
  const act = btn.dataset.act;

  if (act === "edit") return editProject(id);
  if (act === "up" && i > 0) [projects[i - 1], projects[i]] = [projects[i], projects[i - 1]];
  if (act === "down" && i < projects.length - 1) [projects[i + 1], projects[i]] = [projects[i], projects[i + 1]];
  if (act === "delete") {
    if (!btn.classList.contains("armed")) {           // click twice to confirm
      btn.classList.add("armed"); btn.textContent = "Confirm?";
      setTimeout(() => { btn.classList.remove("armed"); btn.textContent = "Delete"; }, 3000);
      return;
    }
    projects.splice(i, 1);
    if (editingId === id) resetForm();
  }
  setDirty(true);
  render();
});

// ---------- publish / download ----------
$("#publish-btn").addEventListener("click", async () => {
  const btn = $("#publish-btn");
  btn.disabled = true; btn.textContent = "Publishing…";
  try {
    const body = {
      message: "Update projects from dashboard",
      content: utf8ToB64(serialize(projects)),
      branch: cfg.branch
    };
    if (fileSha) body.sha = fileSha;
    const r = await gh(cfg, `/contents/${FILE_PATH}`, { method: "PUT", body: JSON.stringify(body) });
    if (r.status === 409) throw new Error("The file changed on GitHub since you loaded it. Press Reload, then redo your edits.");
    if (!r.ok) throw new Error(`GitHub error (${r.status}).`);
    const res = await r.json();
    fileSha = res.content.sha;
    setDirty(false);
    $("#publish-status").textContent = "Published! Your site updates in about a minute.";
  } catch (err) {
    $("#publish-status").textContent = err.message;
  } finally {
    btn.disabled = !isLive(); btn.textContent = "Publish to site";
  }
});

$("#download-btn").addEventListener("click", () => {
  const blob = new Blob([serialize(projects)], { type: "text/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "projects.js";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  if (!isLive()) {
    setDirty(false);
    $("#publish-status").textContent = "Downloaded — replace projects.js in your portfolio folder with it.";
  }
});

$("#reload-btn").addEventListener("click", async () => {
  if (dirty && !$("#reload-btn").classList.contains("armed")) {
    $("#reload-btn").classList.add("armed"); $("#reload-btn").textContent = "Discard changes?";
    setTimeout(() => { $("#reload-btn").classList.remove("armed"); $("#reload-btn").textContent = "Reload"; }, 3000);
    return;
  }
  $("#reload-btn").classList.remove("armed"); $("#reload-btn").textContent = "Reload";
  try { resetForm(); await loadProjects(); } catch (err) { $("#publish-status").textContent = err.message; }
});

// ---------- open / lock ----------
async function enterApp() {
  show("app");
  const badge = $("#mode-badge");
  badge.className = "badge" + (isLive() ? " live" : "");
  badge.textContent = isLive() ? `Connected to github.com/${cfg.owner}/${cfg.repo} (${cfg.branch})` : "Local mode — not connected to GitHub";
  $("#publish-btn").disabled = !isLive();
  $("#publish-btn").title = isLive() ? "" : "Add a GitHub token (reset this device) to publish directly";
  resetForm();
  try { await loadProjects(); } catch (err) { $("#publish-status").textContent = err.message; }
}

function lock() {
  cfg = null; password = null; projects = []; fileSha = null; dirty = false;
  $("#plist").innerHTML = "";
  $("#unlock-form").reset();
  setMsg($("#unlock-msg"), "");
  show("unlock");
  $("#u-pass").focus();
}
$("#lock-btn").addEventListener("click", () => {
  if (dirty && !confirmLeave()) return;
  lock();
});
const confirmLeave = () => {
  const b = $("#lock-btn");
  if (b.classList.contains("armed")) { b.classList.remove("armed"); b.textContent = "Lock"; return true; }
  b.classList.add("armed"); b.textContent = "Unpublished changes — lock anyway?";
  setTimeout(() => { b.classList.remove("armed"); b.textContent = "Lock"; }, 3500);
  return false;
};

window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// Auto-lock after 20 minutes of inactivity
let idleTimer;
const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (cfg && !dirty) lock(); }, 20 * 60 * 1000); };
["click", "keydown", "mousemove", "scroll"].forEach((ev) => addEventListener(ev, resetIdle, { passive: true }));

// ---------- setup ----------
$("#setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#setup-msg");
  const p1 = $("#s-pass").value, p2 = $("#s-pass2").value;
  if (p1.length < 8) return setMsg(msg, "Password must be at least 8 characters.");
  if (p1 !== p2) return setMsg(msg, "Passwords don't match.");

  const data = {
    token: $("#s-token").value.trim(),
    owner: $("#s-owner").value.trim(),
    repo: $("#s-repo").value.trim(),
    branch: $("#s-branch").value.trim() || "main"
  };
  const btn = e.submitter; btn.disabled = true;
  try {
    if (data.token) { setMsg(msg, "Checking GitHub access…", "ok"); await checkRepo(data); }
    await saveVault(data, p1);
    cfg = data; password = p1;
    $("#setup-form").reset();
    enterApp();
  } catch (err) {
    setMsg(msg, err.message);
  } finally { btn.disabled = false; }
});

// ---------- unlock ----------
let failures = 0;
$("#unlock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#unlock-msg"), btn = $("#unlock-btn");
  btn.disabled = true; setMsg(msg, "Unlocking…", "ok");
  try {
    const pass = $("#u-pass").value;
    cfg = await openVault(pass);
    password = pass; failures = 0;
    enterApp();
  } catch (err) {
    failures++;
    setMsg(msg, "Wrong password.");
    $("#u-pass").select();
    // slow down repeated guesses
    await new Promise((r) => setTimeout(r, Math.min(failures * 800, 8000)));
  } finally { btn.disabled = false; }
});

// ---------- settings ----------
$("#pass-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#pass-msg");
  const p1 = $("#p-new").value, p2 = $("#p-new2").value;
  if (p1.length < 8) return setMsg(msg, "At least 8 characters.");
  if (p1 !== p2) return setMsg(msg, "Passwords don't match.");
  await saveVault(cfg, p1);
  password = p1;
  $("#pass-form").reset();
  setMsg(msg, "Password updated.", "ok");
});

function armReset(btn, onConfirm) {
  if (!btn.classList.contains("armed")) {
    const old = btn.textContent;
    btn.classList.add("armed"); btn.textContent = "Click again to confirm";
    setTimeout(() => { btn.classList.remove("armed"); btn.textContent = old; }, 3500);
    return;
  }
  onConfirm();
}
const resetDevice = () => {
  localStorage.removeItem(VAULT_KEY);
  cfg = null; password = null; dirty = false;
  show("setup");
};
$("#reset-btn").addEventListener("click", (e) => armReset(e.currentTarget, resetDevice));
$("#forgot").addEventListener("click", (e) => armReset(e.currentTarget, resetDevice));

// ---------- start ----------
if (!window.crypto || !crypto.subtle) {
  document.body.innerHTML = `<div class="gate"><div class="gate-card"><h1>Unsupported</h1><p>Open the dashboard over https (or as a local file) in a modern browser.</p></div></div>`;
} else {
  show(hasVault() ? "unlock" : "setup");
}
