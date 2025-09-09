/** CONFIG **/
const ADMIN_PIN = "1234"; // PIN secret (Alt+Maj+A pour activer, Alt+Maj+X pour quitter)

/** PLAYLIST PRÉREMPLIE (fichiers hébergés dans /audio) **/
let TRACKS = [
  { title: "Intro", artist: "Moi", src: "../audio/intro.mp3" },
  { title: "Beat 1", artist: "Moi", src: "../audio/beat1.mp3" },
  { title: "Outro", artist: "Moi", src: "../audio/outro.mp3" },
];

/** ÉTAT **/
const audio = new Audio();
let index = 0, isShuffle = false, isRepeat = false;
let isAdmin = false; // toujours faux à l'arrivée (public)

/** DOM **/
const now = document.getElementById("now");
const artist = document.getElementById("artist");
const cover = document.getElementById("cover");
const btnPlay = document.getElementById("play");
const btnPrev = document.getElementById("prev");
const btnNext = document.getElementById("next");
const btnShuffle = document.getElementById("shuffle");
const btnRepeat = document.getElementById("repeat");
const seek = document.getElementById("seek");
const clock = document.getElementById("clock");
const list = document.getElementById("list");
const vol = document.getElementById("vol");

// Admin-only elements (masqués par défaut)
const dropzone = document.getElementById("dropzone");
const adminTools = document.getElementById("adminTools");
const urlForm = document.getElementById("urlForm");
const urlInput = document.getElementById("urlInput");
const m3uInput = document.getElementById("m3uInput");
const dirInput = document.getElementById("dirInput");
const fileInput = document.getElementById("fileInput");

/** HELPERS **/
function fmt(s) {
  s = Math.floor(s);
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
function setActive(i) {
  [...list.children].forEach((el, k) => el.classList.toggle("active", k === i));
}
function setCover(letter = "♪") {
  cover.textContent = (letter || "♪").toString().trim().toUpperCase().slice(0, 1) || "♪";
}
function isAudioUrl(u) {
  return /\.(mp3|ogg|wav|flac|m4a|aac|opus|webm)(\?.*)?$/i.test(u);
}
function fileNameFromUrl(u) {
  try {
    const p = new URL(u, location.href).pathname;
    return decodeURIComponent(p.split("/").pop() || u);
  } catch {
    return u;
  }
}
function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}

/** PERSISTENCE (localStorage – on ne garde pas les blobs locaux) **/
function saveState() {
  try {
    localStorage.setItem("tracks", JSON.stringify(TRACKS.filter(t => !t._blob)));
    localStorage.setItem("index", String(index));
  } catch {}
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("tracks") || "[]");
    if (Array.isArray(saved) && saved.length) TRACKS = saved.concat(TRACKS);
    const savedIndex = Number(localStorage.getItem("index"));
    if (!Number.isNaN(savedIndex)) index = Math.max(0, Math.min(savedIndex, TRACKS.length-1));
  } catch {}
}

/** PLAYER **/
function load(i) {
  index = i;
  const t = TRACKS[i];
  audio.src = t.src;
  now.textContent = t.title || "Sans titre";
  artist.textContent = t.artist || "—";
  setCover(t.title || t.src);
  setActive(i);
}
async function play() {
  try {
    await audio.play();
    btnPlay.textContent = "⏸︎";
  } catch (err) {
    console.warn("Play bloqué par le navigateur :", err);
    btnPlay.textContent = "▶️";
  }
}
function pause() {
  audio.pause();
  btnPlay.textContent = "▶️";
}
function next() {
  index = isShuffle ? Math.floor(Math.random() * TRACKS.length) : (index + 1) % TRACKS.length;
  load(index);
  play();
}
function prev() {
  index = (index - 1 + TRACKS.length) % TRACKS.length;
  load(index);
  play();
}

/** CONTROLES **/
btnPlay.onclick = () => (audio.paused ? play() : pause());
btnNext.onclick = () => { next(); saveState(); };
btnPrev.onclick = () => { prev(); saveState(); };
btnShuffle.onclick = () => {
  isShuffle = !isShuffle;
  btnShuffle.setAttribute("aria-pressed", isShuffle);
};
btnRepeat.onclick = () => {
  isRepeat = !isRepeat;
  btnRepeat.setAttribute("aria-pressed", isRepeat);
};

/* volume 0–100 côté UI -> 0–1 côté audio */
vol.oninput = () => (audio.volume = Math.min(1, Math.max(0, (Number(vol.value)||0) / 100)));

audio.addEventListener("timeupdate", () => {
  if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
  clock.textContent = `${fmt(audio.currentTime)} / ${ audio.duration ? fmt(audio.duration) : "—" }`;
});
seek.addEventListener("input", () => {
  if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
});
audio.addEventListener("ended", () => { if (isRepeat) play(); else next(); saveState(); });
audio.addEventListener("error", () => { console.warn("Erreur lecture, piste suivante."); next(); });

/* Space pour play/pause — sauf si on tape dans un champ */
window.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  const isTyping = tag === "input" || tag === "textarea" || e.target.isContentEditable;
  if (isTyping) return;
  if (e.code === "Space") { e.preventDefault(); btnPlay.click(); }
});

/** RENDER PLAYLIST **/
function renderList() {
  list.innerHTML = "";
  TRACKS.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "track";
    const meta = document.createElement("div");
    meta.className = "meta";
    const tt = document.createElement("div");
    tt.className = "title";
    tt.textContent = t.title || fileNameFromUrl(t.src);
    const ar = document.createElement("div");
    ar.className = "artist";
    ar.textContent = t.artist || "";
    meta.append(tt, ar);
    const badge = document.createElement("div");
    badge.className = "badge";
    let proto = "Fichier";
    try { proto = new URL(t.src, location.href).protocol.startsWith("blob") ? "Local" : "Fichier"; } catch {}
    badge.textContent = proto;
    row.append(meta, badge);
    row.onclick = () => { load(i); play(); saveState(); };
    list.appendChild(row);
  });
}

/** ADMIN (invisible au public) — Activer Alt+Maj+A / Quitter Alt+Maj+X **/
function setAdmin(enabled) {
  isAdmin = !!enabled;
  [dropzone, adminTools].forEach(el => { if (el) el.hidden = !isAdmin; });
}
window.addEventListener("keydown", (e) => {
  // Alt+Shift+A -> login admin
  if (e.altKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
    const pin = prompt("PIN admin :");
    if (pin === ADMIN_PIN) {
      setAdmin(true);
      alert("Mode admin activé (invisible pour le public).");
    } else if (pin !== null) {
      alert("PIN incorrect.");
    }
  }
  // Alt+Shift+X -> logout admin
  if (e.altKey && e.shiftKey && (e.key === "X" || e.key === "x")) {
    setAdmin(false);
    alert("Mode admin désactivé.");
  }
});
function requireAdmin() { return !isAdmin; }

/** AJOUTS (dispo seulement quand admin actif) **/
if (fileInput) {
  fileInput.onchange = (e) => {
    if (requireAdmin()) return;
    addFiles(e.target.files);
    fileInput.value = "";
  };
}
if (dropzone) {
  ["dragenter","dragover"].forEach(ev =>
    dropzone.addEventListener(ev, (e) => {
      if (requireAdmin()) return;
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave","drop"].forEach(ev =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    if (requireAdmin()) return;
    addFiles(e.dataTransfer.files);
  });
}
if (urlForm) {
  urlForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (requireAdmin()) return;
    const url = (urlInput.value || "").trim();
    if (!url) return;
    if (!isAudioUrl(url)) { alert("URL non reconnue comme audio."); return; }
    TRACKS.push({ title: fileNameFromUrl(url), artist: "URL", src: url });
    renderList(); saveState();
    urlInput.value = "";
  });
}
if (m3uInput) {
  m3uInput.addEventListener("change", async (e) => {
    if (requireAdmin()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let count = 0;
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith("#")) continue;
      if (isAudioUrl(l)) {
        TRACKS.push({ title: fileNameFromUrl(l), artist: "M3U", src: l });
        count++;
      }
    }
    renderList(); saveState();
    alert(count ? `Ajouté ${count} piste(s).` : "Aucune URL audio valide.");
    m3uInput.value = "";
  });
}
if (dirInput) {
  dirInput.addEventListener("change", (e) => {
    if (requireAdmin()) return;
    addFiles(e.target.files);
    dirInput.value = "";
  });
}
function addFiles(files) {
  let added = 0;
  for (const f of files) {
    if (!f.type.startsWith("audio/")) continue;
    const url = URL.createObjectURL(f);
    TRACKS.push({ title: stripExt(f.name), artist: "Local", src: url, _blob:true });
    added++;
  }
  if (added) { renderList(); saveState(); }
}

/** Libérer les blobs à la fermeture **/
window.addEventListener("beforeunload", () => {
  TRACKS.forEach(t => { if (t._blob) { try { URL.revokeObjectURL(t.src); } catch {} } });
});

/** INIT **/
loadState();
renderList();
load(index);
setAdmin(false); // public par défaut
