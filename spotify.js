const BACKEND = "http://127.0.0.1:4000";

const loginBtn = document.getElementById("spotifyLogin");
const statusEl = document.getElementById("spotifyStatus");
const listEl   = document.getElementById("list");

// barre de pagination (créée si absente)
let pager = document.getElementById("spotifyPager");
if (!pager) {
  pager = document.createElement("div");
  pager.id = "spotifyPager";
  pager.style.margin = "10px 0";
  pager.innerHTML = `
    <button id="pgPrev" disabled>◀️ Préc.</button>
    <span id="pgInfo" style="margin:0 8px;"></span>
    <button id="pgNext" disabled>Suiv. ▶️</button>
  `;
  // insère la barre juste après le statut
  (statusEl?.parentElement || document.body).insertBefore(pager, statusEl?.nextSibling || null);
}
const pgPrev = document.getElementById("pgPrev");
const pgNext = document.getElementById("pgNext");
const pgInfo = document.getElementById("pgInfo");

// état pagination
let limit = 20;
let offset = 0;
let total = 0;

loginBtn?.addEventListener("click", () => {
  location.href = `${BACKEND}/login`;
});

window.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const s = await fetch(`${BACKEND}/debug/session`, { credentials: "include" });
    const sj = await s.json();
    if (sj.hasTokens) {
      await loadPage(0);
    } else {
      if (statusEl) statusEl.textContent = "Non connecté.";
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = "Erreur: " + e.message;
  } finally {
    const p = new URLSearchParams(location.search);
    if (p.has("logged")) history.replaceState({}, "", location.pathname);
  }
}

pgPrev?.addEventListener("click", () => loadPage(Math.max(0, offset - limit)));
pgNext?.addEventListener("click", () => loadPage(offset + limit));

async function loadPage(newOffset) {
  offset = newOffset;
  if (statusEl) statusEl.textContent = "Chargement des playlists…";
  pgPrev.disabled = true; pgNext.disabled = true;

  const url = `${BACKEND}/api/raw/playlists?limit=${limit}&offset=${offset}`;
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json();

  if (!r.ok) {
    if (statusEl) statusEl.textContent = "Erreur: " + (data.error?.message || JSON.stringify(data));
    listEl.innerHTML = "";
    return;
  }

  total = typeof data.total === "number" ? data.total : (Array.isArray(data.items) ? data.items.length : 0);
  const items = Array.isArray(data.items) ? data.items : [];

  // Affichage statut + total + index
  const from = items.length ? offset + 1 : 0;
  const to   = offset + items.length;
  if (statusEl) statusEl.textContent = `${items.length} playlists affichées — ${from}-${to} / ${total}`;
  if (pgInfo) pgInfo.textContent = `${from}-${to} / ${total}`;

  // Boutons
  pgPrev.disabled = offset <= 0;
  pgNext.disabled = offset + limit >= total;

  // Rendu des cartes
  listEl.innerHTML = items.map(pl => `
    <article class="card">
      <img class="thumb" src="${(pl.images?.[0]?.url || "data:,")}" alt="">
      <div class="meta">
        <h4>${esc(pl.name || "")}</h4>
        <div class="muted">${esc(pl.owner?.display_name || "")} • ${pl.tracks?.total ?? 0} titres</div>
        ${pl.external_urls?.spotify ? `<a class="open" href="${pl.external_urls.spotify}" target="_blank" rel="noopener">Ouvrir dans Spotify</a>` : ""}
      </div>
    </article>
  `).join("");
}

function esc(s=""){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}


