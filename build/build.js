/* ============================================================
   build.js — Static Site Generator GitCMS Company Profile
   Membaca config.json, content/site.json, dan content/posts/*.md,
   lalu membangun website statis ke folder _site/.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");
const T = require("./templates");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "_site");
const POSTS_DIR = path.join(ROOT, "content", "posts");
const SITE_FILE = path.join(ROOT, "content", "site.json");
const MEDIA_FILE = path.join(ROOT, "content", "media.json");

const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
const site = fs.existsSync(SITE_FILE) ? JSON.parse(fs.readFileSync(SITE_FILE, "utf8")) : { company: {} };
const mediaMeta = fs.existsSync(MEDIA_FILE) ? JSON.parse(fs.readFileSync(MEDIA_FILE, "utf8")) : { images: {} };
const U = T.makeUrlHelpers(config);
U.mediaAlt = (image, fallback = "") => {
  const clean = "/" + String(image || "").replace(/^\/+/, "");
  const item = (mediaMeta.images || {})[clean] || (mediaMeta.images || {})[clean.replace(/^\/+/, "")] || {};
  return item.alt || fallback || "";
};

marked.setOptions({ gfm: true, breaks: false });

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writePage(relPath, html) {
  const dir = path.join(OUT, relPath);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}
function writeRaw(relFile, content) {
  const full = path.join(OUT, relFile);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content, "utf8");
}
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    fs.readdirSync(src).forEach((item) => copyRecursive(path.join(src, item), path.join(dest, item)));
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}
function stripMarkdown(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function readingTime(md) {
  const words = stripMarkdown(md).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
function makeExcerpt(meta, body) {
  if (meta.excerpt) return meta.excerpt;
  const text = stripMarkdown(body);
  const words = text.split(/\s+/).slice(0, 34).join(" ");
  return words + (text.split(/\s+/).length > 34 ? "…" : "");
}
function normalizeDate(d) {
  if (!d) return "";
  if (d instanceof Date && !isNaN(d)) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}
function fixContentUrls(html) {
  const bp = U.basePath;
  if (!bp) return html;
  return html.replace(/(\s(?:src|href))="\/(?!\/)/g, `$1="${bp}/`);
}
function readPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter((f) => /\.(md|markdown)$/i.test(f))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const parsed = matter(raw);
      const meta = parsed.data || {};
      const body = parsed.content || "";
      if (typeof meta.tags === "string") meta.tags = meta.tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (!Array.isArray(meta.tags)) meta.tags = meta.tags ? [meta.tags] : [];
      meta.date = normalizeDate(meta.date);
      const slug = meta.slug || file.replace(/\.(md|markdown)$/i, "");
      const featuredImage = meta.featured_image || "";
      const featuredImageAlt = meta.featured_image_alt || U.mediaAlt(featuredImage, meta.title || "");
      const ogImage = featuredImage ? U.abs(featuredImage) : (config.defaultOgImage ? U.abs(config.defaultOgImage) : "");
      return {
        file,
        slug,
        meta,
        body,
        html: fixContentUrls(marked.parse(body)),
        excerpt: makeExcerpt(meta, body),
        readingTime: readingTime(body),
        featuredImage,
        featuredImageAlt,
        ogImage,
      };
    })
    .filter((p) => String(p.meta.status || "published").toLowerCase() !== "draft")
    .sort((a, b) => String(b.meta.date || "").localeCompare(String(a.meta.date || "")));
}

function buildSitemap(posts, categories, tags) {
  const urls = [];
  const add = (loc, lastmod, priority) => {
    urls.push(`  <url>\n    <loc>${T.esc(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n    <priority>${priority}</priority>\n  </url>`);
  };
  add(U.abs("/"), null, "1.0");
  add(U.abs("/tentang-kami/"), null, "0.8");
  add(U.abs("/layanan/"), null, "0.9");
  add(U.abs("/kontak/"), null, "0.8");
  add(U.abs("/blog/"), null, "0.7");
  posts.forEach((p) => add(U.abs(p.permalink), p.meta.date || null, "0.8"));
  Object.keys(categories).forEach((c) => add(U.abs("/kategori/" + T.slugify(c) + "/"), null, "0.5"));
  Object.keys(tags).forEach((t) => add(U.abs("/tag/" + T.slugify(t) + "/"), null, "0.4"));
  writeRaw("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
}

function buildRss(posts) {
  const items = posts.slice(0, 20).map((p) => {
    const pubDate = p.meta.date ? new Date(p.meta.date).toUTCString() : new Date().toUTCString();
    return `    <item>\n      <title>${T.esc(p.meta.title)}</title>\n      <link>${T.esc(U.abs(p.permalink))}</link>\n      <guid>${T.esc(U.abs(p.permalink))}</guid>\n      <pubDate>${pubDate}</pubDate>\n      <description>${T.esc(p.excerpt)}</description>\n    </item>`;
  }).join("\n");
  writeRaw("rss.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>${T.esc(config.title)}</title>\n    <link>${T.esc(U.baseUrl)}/</link>\n    <description>${T.esc(config.description)}</description>\n    <language>${T.esc(config.language || "id")}</language>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n  </channel>\n</rss>`);
}

function build() {
  const start = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  ensureDir(OUT);

  let posts = readPosts();
  posts.forEach((p) => { p.permalink = "/" + p.slug + "/"; });
  console.log(`→ ${posts.length} artikel published ditemukan`);

  writePage("", T.homeTemplate({ posts, config, U, site }));
  writePage("tentang-kami/", T.aboutTemplate({ config, U, site }));
  writePage("layanan/", T.servicesTemplate({ config, U, site }));
  writePage("kontak/", T.contactTemplate({ config, U, site }));

  const perPage = config.postsPerPage || 6;
  const totalPages = Math.max(1, Math.ceil(posts.length / perPage));
  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    const slice = posts.slice(i * perPage, (i + 1) * perPage);
    const html = T.blogIndexTemplate({ posts: slice, pageNum, totalPages, config, U, site });
    writePage(pageNum === 1 ? "blog/" : "blog/page/" + pageNum + "/", html);
  }

  posts.forEach((post) => {
    const related = posts.filter((p) => p.slug !== post.slug).sort((a, b) => {
      const sameA = a.meta.category && a.meta.category === post.meta.category ? -1 : 0;
      const sameB = b.meta.category && b.meta.category === post.meta.category ? -1 : 0;
      return sameA - sameB;
    }).slice(0, 3);
    writePage(post.slug + "/", T.postTemplate({ post, config, U, site, related }));
    writePage("artikel/" + post.slug + "/", T.redirectTemplate({ to: post.permalink, config, U, site }));
  });

  const categories = {};
  posts.forEach((p) => { if (p.meta.category) (categories[p.meta.category] = categories[p.meta.category] || []).push(p); });
  Object.entries(categories).forEach(([term, list]) => writePage("kategori/" + T.slugify(term) + "/", T.archiveTemplate({ kind: "kategori", term, posts: list, config, U, site })));

  const tags = {};
  posts.forEach((p) => (p.meta.tags || []).forEach((t) => (tags[t] = tags[t] || []).push(p)));
  Object.entries(tags).forEach(([term, list]) => writePage("tag/" + T.slugify(term) + "/", T.archiveTemplate({ kind: "tag", term, posts: list, config, U, site })));

  writeRaw("404.html", T.notFoundTemplate({ config, U, site }));
  buildSitemap(posts, categories, tags);
  buildRss(posts);
  writeRaw("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${U.abs("/sitemap.xml")}\n`);

  copyRecursive(path.join(ROOT, "theme"), path.join(OUT, "theme"));
  copyRecursive(path.join(ROOT, "admin"), path.join(OUT, "admin"));
  copyRecursive(path.join(ROOT, "public"), path.join(OUT, "public"));
  writeRaw(".nojekyll", "");

  const secs = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`✓ Build selesai dalam ${secs}s → ${OUT}`);
}

try { build(); } catch (err) { console.error("\n✗ Build gagal:", err); process.exit(1); }
