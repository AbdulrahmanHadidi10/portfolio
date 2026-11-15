/*
  Projects dashboard — one password for every device
  ---------------------------------------------------
  - vault.json (in the repo) holds the GitHub token, encrypted with your password:
    PBKDF2-SHA256 (600,000 iterations) → AES-256-GCM. The password itself is never stored.
  - On any device: open the dashboard → enter the password → vault.json is downloaded
    and the token is decrypted in memory only.
  - vault.json is public (the repo is public), so the password must be long (12+ chars).
  - "Publish" commits projects.js to the repo; GitHub Pages updates the site in ~1 minute.
*/

const REPO = { owner: "AbdulrahmanHadidi10", repo: "portfolio", branch: "main" };
const VAULT_PATH = "vault.json";
const FILE_PATH = "projects.js";
const ITERATIONS = 600000;
const MIN_PASS = 12;
const OLD_LOCAL_KEY = "portfolio-dashboard-vault"; // per-device vault from the previous version

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
const show = (id) => ["loading", "setup", "unlock", "app"].forEach((x) => ($("#" + x).hidden = x !== id));
const setMsg = (el, text, type = "err") => { el.textContent = text; el.className = "msg " + type; };

// ---------- encryption ----------
async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function lockToken(token, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify({ token })));
  return { v: 2, kdf: "PBKDF2-SHA256", iterations: ITERATIONS, cipher: "AES-256-GCM", salt: toB64(salt), iv: toB64(iv), data: toB64(cipher) };
}
async function unlockToken(v, password) {
  const key = await deriveKey(password, fromB64(v.salt), v.iterations || ITERATIONS);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(v.iv) }, key, fromB64(v.data));
  return JSON.parse(dec.decode(plain)).token; // throws if the password is wrong
}

// ---------- GitHub API ----------
function api(path, token, opts = {}) {
  return fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}${path}`, {
    ...opts,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
}
async function getFile(path, token) {
  const r = await api(`/contents/${path}?ref=${REPO.branch}&t=${Date.now()}`, token);
  if (r.status === 404) return null;
  if (r.status === 401) throw new Error("GitHub rejected the token — it may have expired. Replace it in Settings.");
  if (!r.ok) throw new Error(`GitHub error (${r.status}).`);
  const f = await r.json();
  return { sha: f.sha, text: b64ToUtf8(f.content) };
}
async function putFile(path, text, sha, message, token) {
  const body = { message, content: utf8ToB64(text), branch: REPO.branch };
  if (sha) body.sha = sha;
  const r = await api(`/contents/${path}`, token, { method: "PUT", body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) throw new Error("The file changed on GitHub since it was loaded. Press Reload and try again.");
  if (r.status === 401) throw new Error("GitHub rejected the token — it may have expired. Replace it in Settings.");
  if (r.status === 403 || r.status === 404) throw new Error("This token can't write to the portfolio repo. Check its permissions.");
  if (!r.ok) throw new Error(`GitHub error (${r.status}).`);
  return (await r.json()).content.sha;
}
async function checkToken(token) {
  const r = await api("", token);
  if (r.status === 401) throw new Error("GitHub rejected the token. Check that it's copied correctly and not expired.");
  if (r.status === 404) throw new Error(`The token can't access ${REPO.owner}/${REPO.repo}. Give it access to that repo.`);
  if (!r.ok) throw new Error(`GitHub error (${r.status}).`);
  const repo = await r.json();
  if (repo.permissions && !repo.permissions.push) throw new Error("This token can read the repo but not write to it. Set Contents to Read and write.");
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
let vault = null;        // encrypted vault object (public)
let vaultSha = null;
let token = null;        // decrypted token — memory only, cleared on lock
let projects = [];
let fileSha = null;
let editingId = null;
let dirty = false;

async function loadProjects() {
  const f = await getFile(FILE_PATH, token);
  fileSha = f ? f.sha : null;
  projects = f ? parseProjects(f.text).map(normalize) : [];
  setDirty(false);
  render();
}

function setDirty(v) {
  dirty = v;
  $("#publish-status").innerHTML = v ? `<span class="dirty-dot"></span>Unpublished changes` : "Everything is published.";
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

// click-twice confirmation (no browser pop-ups)
function confirmTwice(btn, label, onConfirm) {
  if (!btn.classList.contains("armed")) {
    const old = btn.textContent;
    btn.classList.add("armed"); btn.textContent = label;
    setTimeout(() => { btn.classList.remove("armed"); btn.textContent = old; }, 3500);
    return;
  }
  btn.classList.remove("armed");
  onConfirm();
}

$("#plist").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".pitem").dataset.id;
  const i = projects.findIndex((p) => p.id === id);
  const act = btn.dataset.act;

  if (act === "edit") return editProject(id);
  if (act === "delete") {
    return confirmTwice(btn, "Confirm?", () => {
      projects.splice(i, 1);
      if (editingId === id) resetForm();
      setDirty(true); render();
    });
  }
  if (act === "up" && i > 0) [projects[i - 1], projects[i]] = [projects[i], projects[i - 1]];
  if (act === "down" && i < projects.length - 1) [projects[i + 1], projects[i]] = [projects[i], projects[i + 1]];
  setDirty(true);
  render();
});

// ---------- publish / backup ----------
$("#publish-btn").addEventListener("click", async () => {
  const btn = $("#publish-btn");
  btn.disabled = true; btn.textContent = "Publishing…";
  try {
    fileSha = await putFile(FILE_PATH, serialize(projects), fileSha, "Update projects from dashboard", token);
    setDirty(false);
    $("#publish-status").textContent = "Published! Your site updates in about a minute.";
  } catch (err) {
    $("#publish-status").textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Publish to site";
  }
});

$("#download-btn").addEventListener("click", () => {
  const blob = new Blob([serialize(projects)], { type: "text/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "projects.js";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("#reload-btn").addEventListener("click", (e) => {
  const run = async () => {
    try { resetForm(); await loadProjects(); } catch (err) { $("#publish-status").textContent = err.message; }
  };
  dirty ? confirmTwice(e.currentTarget, "Discard changes?", run) : run();
});

// ---------- open / lock ----------
async function enterApp() {
  show("app");
  $("#mode-badge").textContent = `Connected to github.com/${REPO.owner}/${REPO.repo}`;
  resetForm();
  try { await loadProjects(); } catch (err) { $("#publish-status").textContent = err.message; }
}

function lock() {
  token = null; projects = []; fileSha = null; dirty = false;
  $("#plist").innerHTML = "";
  $("#unlock-form").reset();
  setMsg($("#unlock-msg"), "");
  show("unlock");
  $("#u-pass").focus();
}
$("#lock-btn").addEventListener("click", (e) => {
  dirty ? confirmTwice(e.currentTarget, "Unpublished changes — lock anyway?", lock) : lock();
});

window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// Auto-lock after 20 minutes of inactivity
let idleTimer;
const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (token && !dirty) lock(); }, 20 * 60 * 1000); };
["click", "keydown", "pointermove", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, resetIdle, { passive: true }));

// ---------- one-time setup ----------
$("#setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#setup-msg");
  const p1 = $("#s-pass").value, p2 = $("#s-pass2").value, t = $("#s-token").value.trim();
  if (p1.length < MIN_PASS) return setMsg(msg, `Password must be at least ${MIN_PASS} characters.`);
  if (p1 !== p2) return setMsg(msg, "Passwords don't match.");

  const btn = e.submitter; btn.disabled = true;
  try {
    setMsg(msg, "Checking GitHub access…", "ok");
    await checkToken(t);
    if (await getFile(VAULT_PATH, t)) throw new Error("The dashboard is already set up. Refresh the page and unlock it.");
    setMsg(msg, "Encrypting and saving…", "ok");
    vault = await lockToken(t, p1);
    vaultSha = await putFile(VAULT_PATH, JSON.stringify(vault, null, 2) + "\n", null, "Set up dashboard (encrypted vault)", t);
    token = t;
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
    token = await unlockToken(vault, $("#u-pass").value);
    failures = 0;
    enterApp();
  } catch (err) {
    failures++;
    setMsg(msg, "Wrong password.");
    $("#u-pass").select();
    await new Promise((r) => setTimeout(r, Math.min(failures * 800, 8000)));
  } finally { btn.disabled = false; }
});
$("#forgot").addEventListener("click", () => { $("#forgot-help").hidden = !$("#forgot-help").hidden; });

// ---------- settings ----------
async function saveVault(newVault, msg, okText) {
  // refresh sha in case the vault changed from another device
  const current = await getFile(VAULT_PATH, token);
  vaultSha = await putFile(VAULT_PATH, JSON.stringify(newVault, null, 2) + "\n", current ? current.sha : null, "Update dashboard vault", token);
  vault = newVault;
  setMsg(msg, okText, "ok");
}

$("#pass-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#pass-msg");
  const p1 = $("#p-new").value, p2 = $("#p-new2").value;
  if (p1.length < MIN_PASS) return setMsg(msg, `At least ${MIN_PASS} characters.`);
  if (p1 !== p2) return setMsg(msg, "Passwords don't match.");
  const btn = e.submitter; btn.disabled = true;
  try {
    setMsg(msg, "Saving…", "ok");
    await saveVault(await lockToken(token, p1), msg, "Password updated on every device.");
    $("#pass-form").reset();
  } catch (err) { setMsg(msg, err.message); } finally { btn.disabled = false; }
});

$("#token-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#token-msg");
  const t = $("#t-new").value.trim(), pass = $("#t-pass").value;
  const btn = e.submitter; btn.disabled = true;
  try {
    try { await unlockToken(vault, pass); } catch { throw new Error("Wrong password."); }
    setMsg(msg, "Checking the new token…", "ok");
    await checkToken(t);
    token = t; // save with the new token (works even if the old one expired)
    await saveVault(await lockToken(t, pass), msg, "Token replaced.");
    $("#token-form").reset();
  } catch (err) { setMsg(msg, err.message); } finally { btn.disabled = false; }
});

// ---------- start ----------
async function start() {
  try { localStorage.removeItem(OLD_LOCAL_KEY); } catch (e) {}
  if (!window.crypto || !crypto.subtle) {
    $("#loading-msg").textContent = "Open the dashboard over https in a modern browser.";
    return;
  }
  try {
    const f = await getFile(VAULT_PATH);
    if (f) {
      vault = JSON.parse(f.text); vaultSha = f.sha;
      show("unlock"); $("#u-pass").focus();
    } else {
      show("setup");
    }
  } catch (err) {
    $("#loading-msg").textContent = "Couldn't reach GitHub. Check your connection and refresh.";
    $("#loading-msg").className = "msg err";
  }
}
start();
