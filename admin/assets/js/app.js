/* ============================================================
   app.js — Admin GitHub CMS Company Profile
   Mengelola content/site.json, artikel Markdown, media, dan config.json.
   ============================================================ */

const App = (() => {
  const state = {
    articles: [],
    editing: null,
    confirmCallback: null,
    siteContent: null,
    siteContentSha: null,
    activeSection: "company",
    siteConfig: null,
    siteConfigSha: null,
    mediaMeta: { images: {} },
    mediaMetaSha: null,
  };

  const SITE_CONTENT_PATH = "content/site.json";
  const CONFIG_PATH = "config.json";
  const MEDIA_META_PATH = "content/media.json";
  const MEDIA_PATH = "public/images";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function showLoader(text = "Memuat…") { const t = $("#loader-text"); if (t) t.textContent = text; $("#loader")?.classList.remove("hidden"); }
  function hideLoader() { $("#loader")?.classList.add("hidden"); }
  function escapeHtml(str) { const div = document.createElement("div"); div.textContent = str == null ? "" : String(str); return div.innerHTML; }
  function toast(message, type = "info") {
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ"}</span><span>${escapeHtml(message)}</span>`;
    $("#toast-container").appendChild(el);
    setTimeout(() => { el.classList.add("toast-out"); setTimeout(() => el.remove(), 240); }, 3600);
  }
  function showView(name) { ["login", "setup", "app"].forEach((v) => $(`#view-${v}`)?.classList.toggle("hidden", v !== name)); }
  function showPanel(name) {
    ["pages", "list", "editor", "media", "settings"].forEach((p) => $(`#panel-${p}`)?.classList.toggle("hidden", p !== name));
    $$(".nav-item[data-nav]").forEach((btn) => btn.classList.toggle("active", btn.dataset.nav === name));
  }
  function confirmModal(title, message, confirmText, callback) {
    $("#modal-title").textContent = title;
    $("#modal-message").textContent = message;
    $("#modal-confirm-btn").textContent = confirmText || "Lanjutkan";
    state.confirmCallback = callback;
    $("#modal-confirm").classList.remove("hidden");
  }
  function closeModal() { $("#modal-confirm").classList.add("hidden"); state.confirmCallback = null; }

  async function init() {
    bindGlobalEvents();
    if (!Config.hasToken()) { showView("login"); return; }
    showLoader("Memverifikasi token…");
    const user = await Auth.getCurrentUser();
    hideLoader();
    if (!user) { Config.clearToken(); showView("login"); toast("Token tidak valid. Silakan login ulang.", "error"); return; }
    if (!Config.hasRepoConfig()) { prefillSetup(user); showView("setup"); return; }
    const check = await API.verifyRepo();
    if (!check.ok) { prefillSetup(user); showView("setup"); toast(check.error, "error"); return; }
    enterApp();
  }

  async function handleLogin() {
    const token = $("#input-token").value.trim();
    if (!token) { toast("Token GitHub wajib diisi.", "error"); return; }
    showLoader("Menghubungkan ke GitHub…");
    const result = await Auth.validateToken(token);
    hideLoader();
    if (!result.ok) { toast(result.error, "error"); return; }
    Config.setToken(token);
    toast("Token valid. Silakan pilih repository.", "success");
    prefillSetup(result.user);
    showView("setup");
  }

  function prefillSetup(user) {
    const pill = $("#setup-user-pill");
    if (user && pill) pill.innerHTML = `<img src="${escapeHtml(user.avatar_url)}" alt="" /> Masuk sebagai <strong>${escapeHtml(user.login)}</strong>`;
    const cfg = Config.getAll();
    if (user && !cfg.owner) $("#input-owner").value = user.login || "";
    if (cfg.owner) $("#input-owner").value = cfg.owner;
    if (cfg.repo) $("#input-repo").value = cfg.repo;
    if (cfg.branch) $("#input-branch").value = cfg.branch;
    if (cfg.path) $("#input-path").value = cfg.path;
  }

  async function handleSaveConfig() {
    const owner = $("#input-owner").value.trim();
    const repo = $("#input-repo").value.trim();
    const branch = $("#input-branch").value.trim() || "main";
    const path = $("#input-path").value.trim() || "content/posts";
    if (!owner || !repo) { toast("Owner dan nama repository wajib diisi.", "error"); return; }
    Config.setRepoConfig({ owner, repo, branch, path });
    showLoader("Memverifikasi repository…");
    const check = await API.verifyRepo();
    hideLoader();
    if (!check.ok) { toast(check.error, "error"); return; }
    toast("Repository terhubung.", "success");
    enterApp();
  }

  function enterApp() {
    const cfg = Config.getAll();
    $("#repo-badge").textContent = `${cfg.owner}/${cfg.repo} · ${cfg.branch}`;
    showView("app");
    showPanel("pages");
    Editor.initMDE();
    loadSiteContent();
  }

  /* -------------------- Section editor -------------------- */
  async function loadSiteContent() {
    const wrap = $("#section-editor");
    if (wrap) wrap.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
    try {
      const file = await API.getFile(SITE_CONTENT_PATH);
      if (!file) throw new Error("content/site.json tidak ditemukan.");
      state.siteContentSha = file.sha;
      state.siteContent = JSON.parse(file.content);
      renderSectionEditor();
    } catch (err) {
      if (wrap) wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><h3>Gagal memuat section</h3><p>${escapeHtml(err.message)}</p></div>`;
      toast(`Gagal memuat content/site.json: ${err.message}`, "error");
    }
  }

  function labelize(key) {
    return String(key).replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }
  function getByPath(obj, path) {
    return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }
  function setByPath(obj, path, value) {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = value;
  }
  function shouldTextarea(key, value) {
    const k = String(key).toLowerCase();
    return String(value || "").length > 85 || /(text|subtitle|description|story|intro|note|excerpt|alamat|address|answer|jawaban)/i.test(k);
  }
  function isImageKey(key) {
    return /(image|icon|ikon|foto|photo|gambar|background|thumbnail|cover|heroImage|introImage)$/i.test(String(key || ""));
  }
  function isNumberValue(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function defaultFromTemplate(template) {
    if (Array.isArray(template)) return [];
    if (template && typeof template === "object") {
      const obj = {};
      Object.keys(template).forEach((k) => { obj[k] = defaultFromTemplate(template[k]); });
      return obj;
    }
    return "";
  }

  function renderValue(value, path, keyName) {
    const fullPath = path.join(".");
    if (Array.isArray(value)) {
      const rows = value.map((item, index) => {
        const itemPath = path.concat(index);
        if (item && typeof item === "object") {
          return `<div class="repeater-item"><div class="repeater-head"><strong>${labelize(keyName)} #${index + 1}</strong><button type="button" class="btn btn-ghost btn-small" data-remove-path="${itemPath.join(".")}">Hapus</button></div>${Object.keys(item).map((k) => renderValue(item[k], itemPath.concat(k), k)).join("")}</div>`;
        }
        return `<div class="repeater-line"><input type="text" data-field-path="${itemPath.join(".")}" value="${escapeHtml(item)}" /><button type="button" class="btn btn-ghost btn-small" data-remove-path="${itemPath.join(".")}">Hapus</button></div>`;
      }).join("");
      return `<div class="field section-field"><label>${labelize(keyName)}</label><div class="repeater-list">${rows || `<p class="field-hint">Belum ada item.</p>`}</div><button type="button" class="btn btn-ghost btn-small" data-add-path="${fullPath}">+ Tambah Item</button></div>`;
    }
    if (value && typeof value === "object") {
      return `<div class="section-box"><h3>${labelize(keyName)}</h3>${Object.keys(value).map((k) => renderValue(value[k], path.concat(k), k)).join("")}</div>`;
    }
    const val = value == null ? "" : String(value);
    if (isImageKey(keyName)) {
      const preview = val ? `<img src="${escapeHtml(imagePreviewUrl(val))}" alt="Preview ${escapeHtml(labelize(keyName))}" />` : `<div class="section-image-empty">Belum ada gambar</div>`;
      return `<div class="field section-field section-image-field"><label>${labelize(keyName)}</label><div class="section-image-preview">${preview}</div><div class="section-image-control"><input type="text" data-field-path="${fullPath}" value="${escapeHtml(val)}" placeholder="/public/images/nama-file.jpg" /><button type="button" class="btn btn-primary btn-small" data-upload-image-path="${fullPath}">Upload</button><input type="file" class="visually-hidden-file" data-upload-input-path="${fullPath}" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" /></div><small class="field-hint">Gunakan gambar dari Media atau upload langsung. Path akan disimpan ke <code>content/site.json</code>.</small></div>`;
    }
    if (isNumberValue(value)) {
      return `<div class="field section-field"><label>${labelize(keyName)}</label><input type="number" data-field-type="number" data-field-path="${fullPath}" value="${escapeHtml(val)}" /></div>`;
    }
    if (shouldTextarea(keyName, val)) return `<div class="field section-field"><label>${labelize(keyName)}</label><textarea rows="4" data-field-path="${fullPath}">${escapeHtml(val)}</textarea></div>`;
    return `<div class="field section-field"><label>${labelize(keyName)}</label><input type="text" data-field-path="${fullPath}" value="${escapeHtml(val)}" /></div>`;
  }

  function renderSectionEditor() {
    const root = state.siteContent || {};
    const section = root[state.activeSection];
    const wrap = $("#section-editor");
    $$(".page-tab").forEach((b) => b.classList.toggle("active", b.dataset.section === state.activeSection));
    if (!wrap) return;
    if (!section) { wrap.innerHTML = `<div class="empty-state"><h3>Section tidak ditemukan</h3></div>`; return; }
    wrap.innerHTML = `<div class="section-editor-head"><div><h3>${labelize(state.activeSection)}</h3><p>Perubahan disimpan ke <code>content/site.json</code> dan akan otomatis membangun ulang website.</p></div></div>${renderValue(section, [state.activeSection], state.activeSection)}`;
    bindSectionEditorEvents();
  }

  function bindSectionEditorEvents() {
    $$("[data-field-path]").forEach((el) => {
      el.addEventListener("input", () => {
        const path = el.dataset.fieldPath.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : p);
        const value = el.dataset.fieldType === "number" ? (el.value === "" ? 0 : Number(el.value)) : el.value;
        setByPath(state.siteContent, path, value);
      });
    });
    $$("[data-upload-image-path]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fileInput = btn.parentElement?.querySelector(`[data-upload-input-path="${btn.dataset.uploadImagePath}"]`);
        fileInput?.click();
      });
    });
    $$("[data-upload-input-path]").forEach((input) => {
      input.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        const uploadedPath = await handleUpload(file, { sectionImage: true });
        if (!uploadedPath) return;
        const path = input.dataset.uploadInputPath.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : p);
        setByPath(state.siteContent, path, uploadedPath);
        renderSectionEditor();
        toast("Gambar section berhasil dipasang.", "success");
      });
    });
    $$("[data-add-path]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const path = btn.dataset.addPath.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : p);
        const arr = getByPath(state.siteContent, path);
        if (!Array.isArray(arr)) return;
        const lastKey = path[path.length - 1];
        const template = arr[0] || (String(lastKey).toLowerCase() === "faq" ? { question: "", answer: "" } : { title: "", text: "", url: "" });
        arr.push(defaultFromTemplate(template));
        renderSectionEditor();
      });
    });
    $$("[data-remove-path]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const path = btn.dataset.removePath.split(".").map((p) => /^\d+$/.test(p) ? Number(p) : p);
        const idx = path[path.length - 1];
        const parent = getByPath(state.siteContent, path.slice(0, -1));
        if (Array.isArray(parent)) parent.splice(idx, 1);
        renderSectionEditor();
      });
    });
  }

  async function saveSiteContent() {
    if (!state.siteContent) { toast("Data section belum dimuat.", "error"); return; }
    showLoader("Menyimpan section website…");
    try {
      const json = JSON.stringify(state.siteContent, null, 2) + "\n";
      const res = await API.saveFile(SITE_CONTENT_PATH, json, "Update section website via GudangWeb CMS", state.siteContentSha);
      hideLoader();
      state.siteContentSha = res.content ? res.content.sha : state.siteContentSha;
      toast("Section website berhasil disimpan.", "success");
    } catch (err) {
      hideLoader();
      toast(`Gagal menyimpan section: ${err.message}`, "error");
    }
  }

  /* -------------------- Articles -------------------- */
  async function loadArticles() {
    const cfg = Config.getAll();
    const listEl = $("#article-list");
    listEl.innerHTML = '<div class="skeleton-card"></div>'.repeat(3);
    $("#list-count").textContent = "Memuat…";
    try {
      const files = await API.listFiles(cfg.path);
      const mdFiles = files.filter((f) => f.type === "file" && /\.(md|markdown)$/i.test(f.name));
      const articles = await Promise.all(mdFiles.map(async (f) => {
        try {
          const file = await API.getFile(f.path);
          const parsed = Editor.parse(file.content);
          return { name: f.name, path: f.path, sha: file.sha, meta: parsed.meta, content: file.content };
        } catch (_) {
          return { name: f.name, path: f.path, sha: f.sha, meta: {}, content: "" };
        }
      }));
      articles.sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")) || a.name.localeCompare(b.name));
      state.articles = articles;
      renderArticles(articles);
      populateCategorySuggestions(articles);
    } catch (err) {
      listEl.innerHTML = "";
      $("#list-count").textContent = "Gagal memuat";
      toast(`Gagal memuat artikel: ${err.message}`, "error");
    }
  }
  function renderArticles(articles) {
    const listEl = $("#article-list");
    $("#list-count").textContent = articles.length ? `${articles.length} artikel` : "Belum ada artikel";
    if (!articles.length) { listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">✎</div><h3>Belum ada artikel</h3><p>Tulis artikel pertama untuk halaman Blog.</p><button class="btn btn-primary" onclick="App.newArticle()">+ Tulis Artikel</button></div>`; return; }
    listEl.innerHTML = articles.map((a, i) => {
      const title = a.meta.title || a.name.replace(/\.(md|markdown)$/i, "");
      const status = (a.meta.status || "published").toLowerCase();
      const statusClass = status === "draft" ? "status-draft" : "status-published";
      return `<article class="article-card"><div class="article-info" onclick="App.editArticle(${i})"><h3>${escapeHtml(title)}</h3><div class="article-meta"><span class="status-tag ${statusClass}">${escapeHtml(status)}</span><span>${escapeHtml(a.meta.date || "—")}</span><span class="mono">${escapeHtml(a.name)}</span></div></div><div class="article-card-actions"><button class="btn btn-ghost" onclick="App.editArticle(${i})">Edit</button><button class="btn btn-ghost btn-icon" onclick="App.askDelete(${i})" title="Hapus">🗑</button></div></article>`;
    }).join("");
  }
  function filterArticles(query) {
    const q = query.toLowerCase().trim();
    if (!q) return renderArticles(state.articles);
    renderArticles(state.articles.filter((a) => (a.meta.title || a.name).toLowerCase().includes(q) || a.name.toLowerCase().includes(q)));
  }
  function newArticle() {
    state.editing = null;
    $("#editor-title").textContent = "Tulis Artikel Baru";
    $("#editor-sub").textContent = "Artikel akan tampil di halaman Blog dengan sidebar layanan dan kontak.";
    $("#editor-filename").textContent = "Akan dibuat dari slug saat disimpan";
    $("#meta-title").value = "";
    $("#meta-slug").value = "";
    $("#meta-slug").dataset.touched = "";
    $("#meta-status").value = "published";
    $("#meta-category").value = "";
    $("#meta-date").value = new Date().toISOString().slice(0, 10);
    $("#meta-author").value = "GudangWeb";
    $("#meta-tags").value = "";
    $("#meta-excerpt").value = "";
    $("#meta-image").value = "";
    $("#meta-image-alt").value = "";
    if ($("#meta-faq-title")) $("#meta-faq-title").value = "FAQ Artikel";
    if ($("#meta-faq-description")) $("#meta-faq-description").value = "Pertanyaan umum terkait topik artikel ini.";
    if ($("#meta-faq")) $("#meta-faq").value = "";
    updateFeaturedImagePreview();
    Editor.setValue("");
    showPanel("editor");
  }
  function editArticle(index) {
    const article = state.articles[index];
    if (!article) return;
    state.editing = article;
    const parsed = Editor.parse(article.content);
    const meta = parsed.meta;
    $("#editor-title").textContent = "Edit Artikel";
    $("#editor-sub").textContent = "Perubahan akan di-commit ke repository.";
    $("#editor-filename").textContent = article.path;
    $("#meta-title").value = meta.title || "";
    $("#meta-slug").value = meta.slug || article.name.replace(/\.(md|markdown)$/i, "");
    $("#meta-status").value = (meta.status || "published").toLowerCase();
    $("#meta-category").value = meta.category || "";
    $("#meta-date").value = meta.date || "";
    $("#meta-author").value = meta.author || "GudangWeb";
    $("#meta-tags").value = Array.isArray(meta.tags) ? meta.tags.join(", ") : (meta.tags || "");
    $("#meta-excerpt").value = meta.excerpt || "";
    $("#meta-image").value = meta.featured_image || "";
    $("#meta-image-alt").value = meta.featured_image_alt || "";
    if ($("#meta-faq-title")) $("#meta-faq-title").value = meta.faq_title || "FAQ Artikel";
    if ($("#meta-faq-description")) $("#meta-faq-description").value = meta.faq_description || "Pertanyaan umum terkait topik artikel ini.";
    if ($("#meta-faq")) $("#meta-faq").value = formatFaqLines(meta.faq);
    updateFeaturedImagePreview();
    Editor.setValue(parsed.body);
    showPanel("editor");
  }
  async function saveArticle() {
    const cfg = Config.getAll();
    const title = $("#meta-title").value.trim();
    if (!title) { toast("Judul artikel wajib diisi.", "error"); return; }
    let slug = $("#meta-slug").value.trim();
    if (!slug) { slug = Editor.slugify(title); $("#meta-slug").value = slug; }
    const meta = {
      title,
      slug,
      date: $("#meta-date").value || new Date().toISOString().slice(0, 10),
      status: $("#meta-status").value,
      category: $("#meta-category").value.trim(),
      author: $("#meta-author").value.trim(),
      tags: $("#meta-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
      excerpt: $("#meta-excerpt").value.trim(),
      featured_image: $("#meta-image").value.trim(),
      featured_image_alt: $("#meta-image-alt").value.trim(),
      faq_title: $("#meta-faq-title") ? $("#meta-faq-title").value.trim() : "",
      faq_description: $("#meta-faq-description") ? $("#meta-faq-description").value.trim() : "",
      faq: $("#meta-faq") ? parseFaqLines($("#meta-faq").value) : [],
    };
    const body = Editor.getValue();
    const fileContent = Editor.serialize(meta, body);
    const path = state.editing ? state.editing.path : `${cfg.path}/${slug}.md`;
    const sha = state.editing ? state.editing.sha : null;
    showLoader(state.editing ? "Menyimpan artikel…" : "Membuat artikel…");
    try {
      await API.saveFile(path, fileContent, state.editing ? `Update artikel: ${title}` : `Tambah artikel: ${title}`, sha);
      hideLoader();
      toast("Artikel berhasil disimpan.", "success");
      showPanel("list");
      loadArticles();
    } catch (err) {
      hideLoader();
      toast(`Gagal menyimpan artikel: ${err.message}`, "error");
    }
  }
  function askDelete(index) {
    const article = state.articles[index];
    if (!article) return;
    const title = article.meta.title || article.name;
    confirmModal("Hapus artikel?", `Artikel "${title}" akan dihapus permanen dari repository.`, "Hapus", () => doDelete(article));
  }
  async function doDelete(article) {
    showLoader("Menghapus artikel…");
    try { await API.deleteFile(article.path, article.sha, `Hapus artikel: ${article.meta.title || article.name}`); hideLoader(); toast("Artikel dihapus.", "success"); loadArticles(); }
    catch (err) { hideLoader(); toast(`Gagal menghapus: ${err.message}`, "error"); }
  }

  /* -------------------- Media -------------------- */
  function ensureMediaMetaShape() {
    if (!state.mediaMeta || typeof state.mediaMeta !== "object") state.mediaMeta = { images: {} };
    if (!state.mediaMeta.images || typeof state.mediaMeta.images !== "object" || Array.isArray(state.mediaMeta.images)) state.mediaMeta.images = {};
  }
  function mediaKey(path) { return normalizeImagePath(path); }
  function mediaAlt(path, fallback = "") {
    ensureMediaMetaShape();
    const item = state.mediaMeta.images[mediaKey(path)] || state.mediaMeta.images[String(path || "").replace(/^\/+/, "")] || {};
    return String(item.alt || fallback || "").trim();
  }
  function filenameToAlt(name) {
    return String(name || "").replace(/^[0-9]+-/, "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase());
  }
  async function loadMediaMeta() {
    try {
      const file = await API.getFile(MEDIA_META_PATH);
      if (!file) { state.mediaMeta = { images: {} }; state.mediaMetaSha = null; return; }
      state.mediaMetaSha = file.sha;
      state.mediaMeta = JSON.parse(file.content || "{}");
      ensureMediaMetaShape();
    } catch (err) {
      state.mediaMeta = { images: {} };
      state.mediaMetaSha = null;
      toast(`Gagal memuat alt text media: ${err.message}`, "error");
    }
  }
  async function saveMediaMeta(message = "Update alt text media via CMS", silent = false) {
    ensureMediaMetaShape();
    try {
      const res = await API.saveFile(MEDIA_META_PATH, JSON.stringify(state.mediaMeta, null, 2) + "\n", message, state.mediaMetaSha);
      state.mediaMetaSha = res.content ? res.content.sha : state.mediaMetaSha;
      if (!silent) toast("Alt text media berhasil disimpan.", "success");
      return true;
    } catch (err) {
      if (!silent) toast(`Gagal menyimpan alt text media: ${err.message}`, "error");
      return false;
    }
  }
  async function loadMedia() {
    const grid = $("#media-grid");
    grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(4);
    try {
      const [files] = await Promise.all([API.listFiles(MEDIA_PATH), loadMediaMeta()]);
      const images = files.filter((f) => f.type === "file" && /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name));
      renderMedia(images);
    } catch (err) { grid.innerHTML = ""; toast(`Gagal memuat media: ${err.message}`, "error"); }
  }
  function renderMedia(images) {
    const grid = $("#media-grid");
    if (!images.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">▣</div><h3>Belum ada gambar</h3><p>Upload gambar untuk artikel atau section website.</p></div>`; return; }
    grid.innerHTML = images.map((img) => {
      const publicPath = mediaKey(img.path);
      const alt = mediaAlt(publicPath, filenameToAlt(img.name));
      return `<div class="media-item" data-media-path="${escapeHtml(publicPath)}">
        <img class="media-thumb" src="${escapeHtml(img.download_url || "")}" alt="${escapeHtml(alt || img.name)}" loading="lazy" />
        <div class="media-body">
          <div class="media-name" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</div>
          <label class="media-alt-label">Alt Text SEO</label>
          <textarea class="media-alt-input" rows="2" data-media-alt-input placeholder="Contoh: Jasa pembuatan website company profile GudangWeb">${escapeHtml(alt)}</textarea>
          <div class="media-actions">
            <button type="button" onclick="App.saveMediaAlt('${escapeHtml(publicPath)}')">Simpan Alt</button>
            <button type="button" onclick="App.insertImage('${escapeHtml(publicPath)}','${escapeHtml(img.name)}')">Sisipkan</button>
            <button type="button" onclick="App.setFeaturedImage('${escapeHtml(publicPath)}')">Jadikan Featured</button>
            <button type="button" onclick="App.copyText('${escapeHtml(publicPath)}')">Salin</button>
            <button type="button" class="media-delete" onclick="App.askDeleteMedia('${escapeHtml(img.path)}','${escapeHtml(img.sha || "")}', '${escapeHtml(img.name)}')">Hapus Media</button>
          </div>
        </div>
      </div>`;
    }).join("");
  }
  async function saveMediaAlt(path) {
    ensureMediaMetaShape();
    const key = mediaKey(path);
    const item = document.querySelector(`[data-media-path="${CSS.escape(key)}"]`);
    const input = item ? item.querySelector("[data-media-alt-input]") : null;
    if (!input) return;
    state.mediaMeta.images[key] = Object.assign({}, state.mediaMeta.images[key], { alt: input.value.trim() });
    showLoader("Menyimpan alt text media…");
    const ok = await saveMediaMeta("Update alt text media via CMS", true);
    hideLoader();
    if (ok) { toast("Alt text media disimpan.", "success"); loadMedia(); }
  }
  function askDeleteMedia(path, sha, name) {
    if (!path || !sha) { toast("Data media tidak lengkap untuk dihapus.", "error"); return; }
    confirmModal("Hapus media?", `File "${name}" akan dihapus permanen dari repository. Pastikan gambar ini tidak sedang dipakai di halaman atau artikel.`, "Hapus Media", () => doDeleteMedia(path, sha, name));
  }
  async function doDeleteMedia(path, sha, name) {
    showLoader("Menghapus media…");
    try {
      await API.deleteFile(path, sha, `Hapus media: ${name}`);
      ensureMediaMetaShape();
      delete state.mediaMeta.images[mediaKey(path)];
      await saveMediaMeta(`Hapus alt text media: ${name}`, true);
      hideLoader();
      toast("Media berhasil dihapus.", "success");
      loadMedia();
    } catch (err) { hideLoader(); toast(`Gagal menghapus media: ${err.message}`, "error"); }
  }
  async function handleUpload(file, options = {}) {
    if (!file) return null;
    const allowedByMime = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(file.type || "");
    const allowedByExt = /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name || "");
    if (!allowedByMime && !allowedByExt) { toast("File harus berupa gambar PNG, JPG, GIF, WebP, atau SVG.", "error"); return null; }
    if (file.size > 5 * 1024 * 1024) { toast("Ukuran gambar maksimal 5 MB.", "error"); return null; }
    showLoader("Mengunggah gambar…");
    try {
      const base64 = await fileToBase64(file);
      const safeName = sanitizeFileName(file.name);
      const path = `${MEDIA_PATH}/${Date.now()}-${safeName}`;
      await API.uploadBinary(path, base64, `Upload gambar: ${safeName}`);
      hideLoader();
      const publicPath = normalizeImagePath(path);
      ensureMediaMetaShape();
      if (!state.mediaMeta.images[publicPath]) {
        state.mediaMeta.images[publicPath] = { alt: filenameToAlt(safeName) };
        await saveMediaMeta(`Tambah alt text media: ${safeName}`, true);
      }
      if (options.target === "featured") setFeaturedImage(publicPath, { silent: true, noSwitch: true });
      toast("Gambar berhasil diunggah.", "success");
      loadMedia();
      return publicPath;
    } catch (err) { hideLoader(); toast(`Gagal upload: ${err.message}`, "error"); return null; }
  }
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { const bytes = new Uint8Array(reader.result); let binary = ""; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)); resolve(btoa(binary)); }
        catch (_) { reject(new Error("Gagal mengubah file menjadi Base64.")); }
      };
      reader.onerror = () => reject(new Error("Gagal membaca file."));
      reader.readAsArrayBuffer(file);
    });
  }
  function sanitizeFileName(name) {
    const original = String(name || "gambar");
    const extMatch = original.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
    const base = original.replace(/\.[a-z0-9]+$/i, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "gambar";
    return `${base}${ext}`;
  }
  function normalizeImagePath(path) { const clean = String(path || "").trim(); if (!clean) return ""; if (/^(https?:)?\/\//i.test(clean) || clean.startsWith("data:")) return clean; return `/${clean.replace(/^\/+/, "")}`; }
  function imagePreviewUrl(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
    const cfg = Config.getAll();
    const relPath = value.replace(/^\/+/, "");
    if (cfg.owner && cfg.repo && cfg.branch && relPath) return `https://raw.githubusercontent.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/${encodeURIComponent(cfg.branch)}/${relPath}`;
    return normalizeImagePath(value);
  }
  function updateFeaturedImagePreview() {
    const field = $("#meta-image"), img = $("#featured-image-preview"), empty = $("#featured-image-empty");
    if (!field || !img || !empty) return;
    const value = field.value.trim();
    if (!value) { img.classList.add("hidden"); img.removeAttribute("src"); empty.classList.remove("hidden"); return; }
    img.src = imagePreviewUrl(value); img.classList.remove("hidden"); empty.classList.add("hidden");
  }

  function updateSettingsImagePreview(fieldId, imgId, emptyId) {
    const field = $(fieldId), img = $(imgId), empty = $(emptyId);
    if (!field || !img || !empty) return;
    const value = field.value.trim();
    if (!value) { img.classList.add("hidden"); img.removeAttribute("src"); empty.classList.remove("hidden"); return; }
    img.src = imagePreviewUrl(value); img.classList.remove("hidden"); empty.classList.add("hidden");
  }
  function updateBrandingPreviews() {
    updateSettingsImagePreview("#set-logo", "#set-logo-preview", "#set-logo-empty");
    updateSettingsImagePreview("#set-favicon", "#set-favicon-preview", "#set-favicon-empty");
  }
  function safeHex(value, fallback) {
    const v = String(value || "").trim();
    return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(v) ? v : fallback;
  }
  function setFeaturedImage(path, options = {}) {
    const field = $("#meta-image");
    if (!field) return;
    const normalized = normalizeImagePath(path);
    field.value = normalized;
    const altField = $("#meta-image-alt");
    if (altField && !altField.value.trim()) altField.value = mediaAlt(normalized, filenameToAlt(normalized.split("/").pop()));
    updateFeaturedImagePreview();
    if (!options.noSwitch) showPanel("editor");
    if (!options.silent) toast("Featured image dipasang.", "success");
  }
  function clearFeaturedImage() { $("#meta-image").value = ""; $("#meta-image-alt").value = ""; updateFeaturedImagePreview(); }
  function insertImage(path, name) {
    const normalized = normalizeImagePath(path);
    const alt = mediaAlt(normalized, filenameToAlt(name || normalized.split("/").pop()));
    Editor.insert(`![${alt}](${normalized})`);
    showPanel("editor");
    toast("Gambar disisipkan ke editor.", "success");
  }
  function copyText(text) { navigator.clipboard.writeText(text).then(() => toast("Path disalin.", "success"), () => toast("Gagal menyalin.", "error")); }
  function populateCategorySuggestions(articles) { const cats = [...new Set(articles.map((a) => a.meta.category).filter(Boolean))]; const dl = $("#category-suggestions"); if (dl) dl.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join(""); }

  function formatFaqLines(value) {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return list.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return `${item.question || item.title || ""} | ${item.answer || item.text || ""}`.trim();
      return "";
    }).filter(Boolean).join("\n");
  }
  function parseFaqLines(text) {
    return String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
      if (line.includes("|")) {
        const parts = line.split(/\s*\|\s*/);
        const q = (parts.shift() || "").trim();
        const a = parts.join(" | ").trim();
        return q && a ? `${q} | ${a}` : "";
      }
      return line;
    }).filter(Boolean);
  }


  function defaultHeaderMenu() {
    return [
      { label: "Beranda", url: "/" },
      { label: "Tentang Kami", url: "/tentang-kami/" },
      { label: "Layanan", url: "/layanan/", children: [
        { label: "Jasa Pembuatan Website", url: "/layanan/#website" },
        { label: "Jasa SEO Website", url: "/layanan/#seo" },
        { label: "CMS Berbasis GitHub", url: "/layanan/#cms" },
      ] },
      { label: "Blog", url: "/blog/" },
      { label: "Kontak", url: "/kontak/" },
    ];
  }
  function defaultFooterMenu() {
    return [
      { label: "Beranda", url: "/" },
      { label: "Tentang Kami", url: "/tentang-kami/" },
      { label: "Layanan", url: "/layanan/" },
      { label: "Blog", url: "/blog/" },
      { label: "Kontak", url: "/kontak/" },
    ];
  }
  function normalizeMenuItems(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      label: String(item && item.label ? item.label : "").trim(),
      url: String(item && item.url ? item.url : "").trim(),
      children: normalizeMenuItems(item && item.children),
    })).filter((item) => item.label || item.children.length);
  }
  function childLines(children) {
    return normalizeMenuItems(children).map((child) => `${child.label} | ${child.url || "#"}`).join("\n");
  }
  function parseChildLines(value) {
    return String(value || "").split(/\n+/).map((line) => {
      const raw = line.trim();
      if (!raw) return null;
      const parts = raw.split("|");
      const label = (parts.shift() || "").trim();
      const url = (parts.join("|") || "#").trim() || "#";
      return label ? { label, url } : null;
    }).filter(Boolean);
  }
  function menuRowHtml(item, index, type) {
    const labelText = type === "footer" ? "Nama Grup/Menu" : "Nama Menu";
    const urlText = type === "footer" ? "URL Utama (boleh kosong untuk grup footer)" : "URL Utama";
    return `<div class="menu-builder-item" data-menu-row>
      <div class="menu-builder-head">
        <strong>${type === "footer" ? "Menu Footer" : "Menu Header"} #${index + 1}</strong>
        <button type="button" class="btn btn-ghost btn-small" data-remove-menu>Hapus</button>
      </div>
      <div class="field-row">
        <div class="field"><label>${labelText}</label><input type="text" data-menu-label value="${escapeHtml(item.label || "")}" placeholder="cth: Layanan" /></div>
        <div class="field"><label>${urlText}</label><input type="text" data-menu-url value="${escapeHtml(item.url || "")}" placeholder="cth: /layanan/" /></div>
      </div>
      <div class="field"><label>Sub Menu</label><textarea data-menu-children rows="4" placeholder="Jasa Pembuatan Website | /layanan/#website\nJasa SEO Website | /layanan/#seo">${escapeHtml(childLines(item.children))}</textarea><p class="field-hint">Format: <code>Nama Sub Menu | /link/</code>. Kosongkan jika tidak menggunakan sub menu.</p></div>
    </div>`;
  }
  function renderMenuBuilder(containerSelector, items, type) {
    const container = $(containerSelector);
    if (!container) return;
    const normalized = normalizeMenuItems(items);
    container.innerHTML = (normalized.length ? normalized : [{ label: "", url: "", children: [] }]).map((item, index) => menuRowHtml(item, index, type)).join("");
    container.querySelectorAll("[data-remove-menu]").forEach((btn) => btn.addEventListener("click", () => {
      const row = btn.closest("[data-menu-row]");
      row?.remove();
      if (!container.querySelector("[data-menu-row]")) addMenuRow(containerSelector, type);
    }));
  }
  function addMenuRow(containerSelector, type, item = { label: "", url: "", children: [] }) {
    const container = $(containerSelector);
    if (!container) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = menuRowHtml(item, container.querySelectorAll("[data-menu-row]").length, type);
    const row = wrap.firstElementChild;
    container.appendChild(row);
    row.querySelector("[data-remove-menu]")?.addEventListener("click", () => {
      row.remove();
      if (!container.querySelector("[data-menu-row]")) addMenuRow(containerSelector, type);
    });
  }
  function collectMenuBuilder(containerSelector) {
    const container = $(containerSelector);
    if (!container) return [];
    return Array.from(container.querySelectorAll("[data-menu-row]")).map((row) => {
      const label = row.querySelector("[data-menu-label]")?.value.trim() || "";
      const url = row.querySelector("[data-menu-url]")?.value.trim() || "";
      const children = parseChildLines(row.querySelector("[data-menu-children]")?.value || "");
      if (!label && !children.length) return null;
      return { label: label || "Menu", url, children };
    }).filter(Boolean);
  }
  function flattenFooterMenu(items) {
    const seen = new Set();
    const links = [];
    normalizeMenuItems(items).forEach((item) => {
      if (item.url) links.push({ label: item.label, url: item.url });
      normalizeMenuItems(item.children).forEach((child) => links.push({ label: child.label, url: child.url || "#" }));
      if (!item.url && !item.children.length && item.label) links.push({ label: item.label, url: "#" });
    });
    return links.filter((item) => {
      const key = `${item.label}|${item.url}`;
      if (!item.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function footerMenuRowHtml(item, index) {
    return `<div class="menu-builder-item" data-footer-menu-row>
      <div class="menu-builder-head">
        <strong>Link Footer #${index + 1}</strong>
        <button type="button" class="btn btn-ghost btn-small" data-remove-footer-menu>Hapus</button>
      </div>
      <div class="field-row">
        <div class="field"><label>Nama Link</label><input type="text" data-footer-menu-label value="${escapeHtml(item.label || "")}" placeholder="cth: Tentang Kami" /></div>
        <div class="field"><label>URL</label><input type="text" data-footer-menu-url value="${escapeHtml(item.url || "")}" placeholder="cth: /tentang-kami/" /></div>
      </div>
    </div>`;
  }
  function bindFooterMenuRemove(row, containerSelector) {
    row.querySelector("[data-remove-footer-menu]")?.addEventListener("click", () => {
      row.remove();
      const container = $(containerSelector);
      if (container && !container.querySelector("[data-footer-menu-row]")) addFooterMenuRow(containerSelector);
    });
  }
  function renderFooterMenuBuilder(containerSelector, items) {
    const container = $(containerSelector);
    if (!container) return;
    const normalized = flattenFooterMenu(items);
    container.innerHTML = (normalized.length ? normalized : defaultFooterMenu()).map((item, index) => footerMenuRowHtml(item, index)).join("");
    container.querySelectorAll("[data-footer-menu-row]").forEach((row) => bindFooterMenuRemove(row, containerSelector));
  }
  function addFooterMenuRow(containerSelector, item = { label: "", url: "" }) {
    const container = $(containerSelector);
    if (!container) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = footerMenuRowHtml(item, container.querySelectorAll("[data-footer-menu-row]").length);
    const row = wrap.firstElementChild;
    container.appendChild(row);
    bindFooterMenuRemove(row, containerSelector);
  }
  function collectFooterMenuBuilder(containerSelector) {
    const container = $(containerSelector);
    if (!container) return [];
    return Array.from(container.querySelectorAll("[data-footer-menu-row]")).map((row) => {
      const label = row.querySelector("[data-footer-menu-label]")?.value.trim() || "";
      const url = row.querySelector("[data-footer-menu-url]")?.value.trim() || "";
      return label ? { label, url: url || "#" } : null;
    }).filter(Boolean);
  }

  /* -------------------- Settings -------------------- */
  async function loadSettings() {
    showLoader("Memuat pengaturan…");
    try {
      const file = await API.getFile(CONFIG_PATH);
      hideLoader();
      if (!file) throw new Error("config.json tidak ditemukan.");
      state.siteConfigSha = file.sha;
      const cfg = JSON.parse(file.content);
      state.siteConfig = cfg;
      const s = cfg.social || {};
      const b = cfg.branding || {};
      const t = cfg.theme || {};
      const f = cfg.footer || {};
      $("#set-title").value = cfg.title || "";
      $("#set-tagline").value = cfg.tagline || "";
      $("#set-description").value = cfg.description || "";
      $("#set-author").value = cfg.author || "";
      $("#set-footer-copyright").value = f.copyrightText || `© {year} ${cfg.author || cfg.title || ""}. ${cfg.footerText || ""}`.trim();
      $("#set-footer-credit-text").value = f.creditText || "Build with gitcompro";
      $("#set-footer-credit-url").value = f.creditUrl || "https://www.gudangweb.com";
      $("#set-logo").value = b.logo || "";
      $("#set-logo-alt").value = b.logoAlt || cfg.title || "";
      $("#set-favicon").value = b.favicon || "";
      $("#set-show-title").value = b.showSiteTitle === false ? "false" : "true";
      $("#set-primary").value = safeHex(t.primaryColor, "#155eef");
      $("#set-primary-dark").value = safeHex(t.primaryDarkColor, "#0b45c8");
      $("#set-accent").value = safeHex(t.accentColor, "#38bdf8");
      $("#set-dark").value = safeHex(t.darkColor, "#0b1220");
      $("#set-bg").value = safeHex(t.backgroundColor, "#f7f9fc");
      $("#set-surface").value = safeHex(t.surfaceColor, "#ffffff");
      $("#set-text").value = safeHex(t.textColor, "#0f172a");
      $("#set-muted").value = safeHex(t.mutedColor, "#64748b");
      $("#set-border").value = safeHex(t.borderColor, "#e2e8f0");
      $("#set-soft").value = safeHex(t.softColor, "#dbeafe");
      updateBrandingPreviews();
      $("#set-baseurl").value = cfg.baseUrl || "";
      $("#set-basepath").value = cfg.basePath || "";
      $("#set-perpage").value = cfg.postsPerPage || 6;
      $("#set-github").value = s.github || "";
      $("#set-twitter").value = s.twitter || "";
      $("#set-instagram").value = s.instagram || "";
      $("#set-linkedin").value = s.linkedin || "";
      $("#set-email").value = s.email || "";
      renderMenuBuilder("#header-menu-builder", cfg.nav && cfg.nav.length ? cfg.nav : defaultHeaderMenu(), "header");
      renderFooterMenuBuilder("#footer-menu-builder", cfg.footerMenu && cfg.footerMenu.length ? cfg.footerMenu : defaultFooterMenu());
    } catch (err) { hideLoader(); toast(`Gagal memuat pengaturan: ${err.message}`, "error"); }
  }
  async function saveSettings() {
    const cfg = Object.assign({}, state.siteConfig || {});
    cfg.title = $("#set-title").value.trim();
    cfg.tagline = $("#set-tagline").value.trim();
    cfg.description = $("#set-description").value.trim();
    cfg.author = $("#set-author").value.trim();
    cfg.baseUrl = $("#set-baseurl").value.trim().replace(/\/+$/, "");
    cfg.basePath = $("#set-basepath").value.trim().replace(/\/+$/, "");
    cfg.postsPerPage = parseInt($("#set-perpage").value, 10) || 6;
    cfg.nav = collectMenuBuilder("#header-menu-builder").length ? collectMenuBuilder("#header-menu-builder") : defaultHeaderMenu();
    cfg.footerMenu = collectFooterMenuBuilder("#footer-menu-builder").length ? collectFooterMenuBuilder("#footer-menu-builder") : defaultFooterMenu();
    cfg.footer = Object.assign({}, cfg.footer, {
      copyrightText: $("#set-footer-copyright").value.trim() || "© {year} GudangWeb. All rights reserved.",
      creditText: $("#set-footer-credit-text").value.trim() || "Build with gitcompro",
      creditUrl: $("#set-footer-credit-url").value.trim() || "https://www.gudangweb.com",
    });
    cfg.branding = Object.assign({}, cfg.branding, {
      logo: $("#set-logo").value.trim(),
      logoAlt: $("#set-logo-alt").value.trim() || cfg.title,
      favicon: $("#set-favicon").value.trim(),
      showSiteTitle: $("#set-show-title").value !== "false",
    });
    cfg.theme = Object.assign({}, cfg.theme, {
      primaryColor: safeHex($("#set-primary").value, "#155eef"),
      primaryDarkColor: safeHex($("#set-primary-dark").value, "#0b45c8"),
      accentColor: safeHex($("#set-accent").value, "#38bdf8"),
      darkColor: safeHex($("#set-dark").value, "#0b1220"),
      backgroundColor: safeHex($("#set-bg").value, "#f7f9fc"),
      surfaceColor: safeHex($("#set-surface").value, "#ffffff"),
      textColor: safeHex($("#set-text").value, "#0f172a"),
      mutedColor: safeHex($("#set-muted").value, "#64748b"),
      borderColor: safeHex($("#set-border").value, "#e2e8f0"),
      softColor: safeHex($("#set-soft").value, "#dbeafe"),
    });
    cfg.social = Object.assign({}, cfg.social, { github: $("#set-github").value.trim(), twitter: $("#set-twitter").value.trim(), instagram: $("#set-instagram").value.trim(), linkedin: $("#set-linkedin").value.trim(), email: $("#set-email").value.trim() });
    showLoader("Menyimpan pengaturan…");
    try { const res = await API.saveFile(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "Update pengaturan situs via CMS", state.siteConfigSha); hideLoader(); state.siteConfigSha = res.content ? res.content.sha : state.siteConfigSha; state.siteConfig = cfg; toast("Pengaturan disimpan.", "success"); }
    catch (err) { hideLoader(); toast(`Gagal menyimpan: ${err.message}`, "error"); }
  }

  function logout() {
    confirmModal("Keluar dari CMS?", "Token akan dihapus dari browser ini.", "Keluar", () => { Config.clearToken(); showView("login"); $("#input-token").value = ""; toast("Anda telah keluar.", "info"); });
  }

  function bindGlobalEvents() {
    $("#btn-login")?.addEventListener("click", handleLogin);
    $("#input-token")?.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });
    $("#btn-save-config")?.addEventListener("click", handleSaveConfig);
    $("#btn-logout-setup")?.addEventListener("click", () => { Config.clearToken(); showView("login"); });

    $$(".nav-item[data-nav]").forEach((btn) => btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;
      if (nav === "editor") newArticle();
      else { showPanel(nav); if (nav === "pages" && !state.siteContent) loadSiteContent(); if (nav === "list") loadArticles(); if (nav === "media") loadMedia(); if (nav === "settings") loadSettings(); }
    }));
    $$(".page-tab").forEach((btn) => btn.addEventListener("click", () => { state.activeSection = btn.dataset.section; renderSectionEditor(); }));
    $("#btn-reload-site-content")?.addEventListener("click", loadSiteContent);
    $("#btn-save-site-content")?.addEventListener("click", saveSiteContent);

    $("#btn-new-article")?.addEventListener("click", newArticle);
    $("#btn-refresh")?.addEventListener("click", loadArticles);
    $("#btn-cancel-edit")?.addEventListener("click", () => showPanel("list"));
    $("#btn-save-article")?.addEventListener("click", saveArticle);
    $("#search-input")?.addEventListener("input", (e) => filterArticles(e.target.value));
    $("#meta-title")?.addEventListener("input", (e) => { if (!state.editing && !$("#meta-slug").dataset.touched) $("#meta-slug").value = Editor.slugify(e.target.value); });
    $("#meta-slug")?.addEventListener("input", () => { $("#meta-slug").dataset.touched = "1"; });

    $("#btn-refresh-media")?.addEventListener("click", loadMedia);
    $("#btn-upload-media")?.addEventListener("click", () => $("#media-upload").click());
    $("#media-upload")?.addEventListener("change", (e) => { handleUpload(e.target.files[0]); e.target.value = ""; });
    $("#btn-upload-featured-image")?.addEventListener("click", () => $("#featured-image-upload").click());
    $("#featured-image-upload")?.addEventListener("change", (e) => { handleUpload(e.target.files[0], { target: "featured" }); e.target.value = ""; });
    $("#btn-open-media-for-featured")?.addEventListener("click", () => { showPanel("media"); loadMedia(); toast("Pilih tombol ‘Jadikan Featured’ pada gambar.", "info"); });
    $("#btn-clear-featured-image")?.addEventListener("click", clearFeaturedImage);
    $("#meta-image")?.addEventListener("input", updateFeaturedImagePreview);

    $("#btn-save-settings")?.addEventListener("click", saveSettings);
    $("#btn-add-header-menu")?.addEventListener("click", () => addMenuRow("#header-menu-builder", "header"));
    $("#btn-add-footer-menu")?.addEventListener("click", () => addFooterMenuRow("#footer-menu-builder"));
    $("#set-logo")?.addEventListener("input", updateBrandingPreviews);
    $("#set-favicon")?.addEventListener("input", updateBrandingPreviews);
    $("#btn-upload-logo")?.addEventListener("click", () => $("#logo-upload").click());
    $("#logo-upload")?.addEventListener("change", async (e) => { const path = await handleUpload(e.target.files[0]); e.target.value = ""; if (path) { $("#set-logo").value = path; updateBrandingPreviews(); toast("Logo berhasil dipasang.", "success"); } });
    $("#btn-upload-favicon")?.addEventListener("click", () => $("#favicon-upload").click());
    $("#favicon-upload")?.addEventListener("change", async (e) => { const path = await handleUpload(e.target.files[0]); e.target.value = ""; if (path) { $("#set-favicon").value = path; updateBrandingPreviews(); toast("Favicon berhasil dipasang.", "success"); } });
    $("#btn-settings")?.addEventListener("click", () => { prefillSetup(null); const cfg = Config.getAll(); $("#input-owner").value = cfg.owner; showView("setup"); });
    $("#btn-logout")?.addEventListener("click", logout);
    $("#modal-cancel")?.addEventListener("click", closeModal);
    $("#modal-confirm-btn")?.addEventListener("click", () => { if (state.confirmCallback) state.confirmCallback(); closeModal(); });
    $("#modal-confirm")?.addEventListener("click", (e) => { if (e.target.id === "modal-confirm") closeModal(); });
  }

  return { init, newArticle, editArticle, askDelete, insertImage, setFeaturedImage, copyText, saveMediaAlt, askDeleteMedia };
})();

document.addEventListener("DOMContentLoaded", App.init);
