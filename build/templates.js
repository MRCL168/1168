/* ============================================================
   templates.js — Template company profile + blog untuk GitCMS
   Semua halaman utama membaca content/site.json agar section dapat
   diedit dari panel admin tanpa mengubah file template.
   ============================================================ */

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function attr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function cssUrl(str) {
  return String(str == null ? "" : str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
function textToHtml(text) {
  return esc(text || "").split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n");
}
function makeUrlHelpers(config) {
  const basePath = (config.basePath || "").replace(/\/+$/, "");
  const baseUrl = (config.baseUrl || "").replace(/\/+$/, "");
  return {
    url: (p) => {
      if (/^(https?:)?\/\//i.test(String(p || "")) || String(p || "").startsWith("mailto:") || String(p || "").startsWith("tel:")) return p;
      const clean = "/" + String(p || "").replace(/^\/+/, "");
      return (basePath + clean).replace(/\/{2,}/g, "/").replace(":/", "://");
    },
    abs: (p) => {
      if (/^(https?:)?\/\//i.test(String(p || ""))) return p;
      const clean = "/" + String(p || "").replace(/^\/+/, "");
      return baseUrl + clean.replace(/\/{2,}/g, "/");
    },
    basePath,
    baseUrl,
  };
}

function whatsappUrl(site, message) {
  const company = site.company || {};
  const phone = String(company.whatsapp || company.phone || "").replace(/\D/g, "");
  const text = encodeURIComponent(message || `Halo GudangWeb, saya ingin konsultasi pembuatan website dan SEO.`);
  return phone ? `https://wa.me/${phone}?text=${text}` : "/kontak/";
}
function bgStyle(image, U, prop = "--hero-bg") {
  if (!image) return "";
  return ` style="${attr(`${prop}:url('${cssUrl(U.url(image))}')`)}"`;
}
function imageHtml(image, alt, U, className = "") {
  if (!image) return "";
  const finalAlt = alt || (U && typeof U.mediaAlt === "function" ? U.mediaAlt(image) : "");
  return `<img ${className ? `class="${attr(className)}"` : ""} src="${attr(U.url(image))}" alt="${attr(finalAlt || "")}" loading="lazy">`;
}


function compactSchema(value) {
  if (Array.isArray(value)) {
    const arr = value.map(compactSchema).filter((item) => {
      if (item == null) return false;
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object") return Object.keys(item).length > 0;
      return String(item).trim() !== "";
    });
    return arr.length ? arr : undefined;
  }
  if (value && typeof value === "object") {
    const obj = {};
    Object.entries(value).forEach(([key, val]) => {
      const cleaned = compactSchema(val);
      if (cleaned == null) return;
      if (Array.isArray(cleaned) && !cleaned.length) return;
      if (typeof cleaned === "object" && !Array.isArray(cleaned) && !Object.keys(cleaned).length) return;
      obj[key] = cleaned;
    });
    return Object.keys(obj).length ? obj : undefined;
  }
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}
function schemaGraph(items) {
  const list = (Array.isArray(items) ? items : [items]).map(compactSchema).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return JSON.stringify(Object.assign({ "@context": "https://schema.org" }, list[0]));
  return JSON.stringify({ "@context": "https://schema.org", "@graph": list });
}
function socialProfileUrls(config) {
  const s = config.social || {};
  const urls = [];
  if (s.github) urls.push(`https://github.com/${String(s.github).replace(/^@/, "")}`);
  if (s.instagram) urls.push(`https://instagram.com/${String(s.instagram).replace(/^@/, "")}`);
  if (s.linkedin) urls.push(`https://linkedin.com/in/${String(s.linkedin).replace(/^@/, "")}`);
  if (s.twitter) urls.push(`https://x.com/${String(s.twitter).replace(/^@/, "")}`);
  return urls;
}
function organizationSchema(config, U, site) {
  const company = site.company || {};
  const branding = config.branding || {};
  return {
    "@type": "Organization",
    "@id": U.baseUrl ? `${U.baseUrl}/#organization` : undefined,
    name: company.name || config.title,
    url: company.website || U.baseUrl || undefined,
    logo: branding.logo ? U.abs(branding.logo) : undefined,
    description: company.description || config.description,
    telephone: company.phone || company.whatsapp,
    email: company.email || (config.social || {}).email,
    address: company.address ? { "@type": "PostalAddress", streetAddress: company.address, addressCountry: "ID" } : undefined,
    sameAs: socialProfileUrls(config),
  };
}
function websiteSchema(config, U, site) {
  return {
    "@type": "WebSite",
    "@id": U.baseUrl ? `${U.baseUrl}/#website` : undefined,
    name: config.title,
    url: U.baseUrl || undefined,
    description: config.description,
    inLanguage: config.language || "id",
    publisher: U.baseUrl ? { "@id": `${U.baseUrl}/#organization` } : undefined,
  };
}
function professionalServiceSchema(config, U, site) {
  const company = site.company || {};
  return {
    "@type": "ProfessionalService",
    "@id": U.baseUrl ? `${U.baseUrl}/#professionalservice` : undefined,
    name: company.name || config.title,
    url: U.baseUrl || company.website || undefined,
    description: company.description || config.description,
    telephone: company.phone || company.whatsapp,
    email: company.email || (config.social || {}).email,
    address: company.address ? { "@type": "PostalAddress", streetAddress: company.address, addressCountry: "ID" } : undefined,
    areaServed: company.areaServed || "Indonesia",
  };
}
function webPageSchema(config, url, title, description, type = "WebPage") {
  return {
    "@type": type,
    name: title || config.title,
    description: description || config.description,
    url,
    inLanguage: config.language || "id",
  };
}
function breadcrumbSchema(items) {
  const cleaned = (Array.isArray(items) ? items : []).filter((item) => item && item.name && item.url);
  if (cleaned.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: cleaned.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
function normalizeFaqItems(faq) {
  const raw = Array.isArray(faq) ? faq : [];
  return raw.map((item) => {
    if (typeof item === "string") {
      const parts = item.split(/\s*\|\s*/);
      return { question: parts[0] || "", answer: parts.slice(1).join(" | ") || "" };
    }
    return {
      question: item && (item.question || item.title || item.q || item.pertanyaan) || "",
      answer: item && (item.answer || item.text || item.a || item.jawaban) || "",
    };
  }).map((item) => ({ question: String(item.question || "").trim(), answer: String(item.answer || "").trim() }))
    .filter((item) => item.question && item.answer);
}
function faqSchema(faq) {
  const items = normalizeFaqItems(faq);
  if (!items.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
function faqSection(faq, opts = {}) {
  const items = normalizeFaqItems(faq);
  if (!items.length) return "";
  const title = opts.title || "Pertanyaan yang Sering Diajukan";
  const description = opts.description || "Jawaban ringkas untuk beberapa pertanyaan umum sebelum menggunakan layanan GudangWeb.";
  return `<section class="section section-faq ${attr(opts.className || "")}">
    <div class="container section-head"><span class="eyebrow">FAQ</span><h2>${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ""}</div>
    <div class="container faq-list">${items.map((item, index) => `<details class="faq-item" ${index === 0 ? "open" : ""}><summary><span>${esc(item.question)}</span><em>+</em></summary><div class="faq-answer">${textToHtml(item.answer)}</div></details>`).join("")}</div>
  </section>`;
}

function safeColor(value, fallback) {
  const v = String(value || "").trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback;
}
function themeStyle(config) {
  const t = config.theme || {};
  const vars = {
    "--bg": safeColor(t.backgroundColor, "#f7f9fc"),
    "--surface": safeColor(t.surfaceColor, "#ffffff"),
    "--ink": safeColor(t.textColor, "#0f172a"),
    "--muted": safeColor(t.mutedColor, "#64748b"),
    "--line": safeColor(t.borderColor, "#e2e8f0"),
    "--primary": safeColor(t.primaryColor, "#155eef"),
    "--primary-dark": safeColor(t.primaryDarkColor, "#0b45c8"),
    "--accent": safeColor(t.accentColor, "#38bdf8"),
    "--navy": safeColor(t.darkColor, "#0b1220"),
    "--soft": safeColor(t.softColor, "#dbeafe"),
  };
  const body = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";");
  return `<style id="theme-settings">:root{${body};--brand-gradient:linear-gradient(135deg,var(--primary),var(--accent))}</style>`;
}
function logoMarkup(config, U, linkClass) {
  const branding = config.branding || {};
  const logo = branding.logo || "";
  const logoAlt = branding.logoAlt || config.title || "Logo";
  const showTitle = branding.showSiteTitle !== false;
  const text = showTitle ? `<span>${esc(config.title)}</span>` : "";
  if (logo) {
    return `<a href="${attr(U.url("/"))}" class="${attr(linkClass)} has-custom-logo"><img class="site-logo-img" src="${attr(U.url(logo))}" alt="${attr(logoAlt)}">${text}</a>`;
  }
  return `<a href="${attr(U.url("/"))}" class="${attr(linkClass)}"><span class="logo-mark">GW</span><span>${esc(config.title)}</span></a>`;
}

function iconSvg(name) {
  const icons = {
    github: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.53 9.53 0 0 1 12 6.01c.85 0 1.7.11 2.5.34 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .26.18.57.69.47A10 10 0 0 0 12 2Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8Zm8.96 1.9a1.26 1.26 0 1 1 0 2.52 1.26 1.26 0 0 1 0-2.52ZM12 7.25A4.75 4.75 0 1 1 12 16.75 4.75 4.75 0 0 1 12 7.25Zm0 2A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z"/></svg>`,
    linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.94 8.9H3.72V20h3.22V8.9ZM5.33 4a1.86 1.86 0 1 0 0 3.72 1.86 1.86 0 0 0 0-3.72Zm4.26 4.9V20h3.08v-5.49c0-1.45.27-2.85 2.07-2.85 1.77 0 1.79 1.66 1.79 2.94V20h3.21v-6.09c0-2.99-.64-5.29-4.14-5.29-1.68 0-2.81.92-3.27 1.79h-.04V8.9H9.59Z"/></svg>`,
    twitter: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2.5h3.02l-6.6 7.54 7.76 11.46h-6.07l-4.75-6.22-5.44 6.22H3.8l7.06-8.07L3.42 2.5h6.22l4.3 5.68 4.96-5.68Zm-1.06 16.98h1.67L8.72 4.42H6.93l10.91 15.06Z"/></svg>`,
    email: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5h15A2.5 2.5 0 0 1 22 7.5v9A2.5 2.5 0 0 1 19.5 19h-15A2.5 2.5 0 0 1 2 16.5v-9A2.5 2.5 0 0 1 4.5 5Zm0 2c-.28 0-.5.22-.5.5v.38l8 4.72 8-4.72V7.5c0-.28-.22-.5-.5-.5h-15Zm15 10c.28 0 .5-.22.5-.5V10.2l-7.49 4.42a1 1 0 0 1-1.02 0L4 10.2v6.3c0 .28.22.5.5.5h15Z"/></svg>`
  };
  return icons[name] || "";
}
function socialItem(name, href, label) {
  return `<a class="social-link social-${attr(name)}" href="${attr(href)}" rel="me" aria-label="${attr(label)}">${iconSvg(name)}<span>${esc(label)}</span></a>`;
}
function socialLinks(config) {
  const s = config.social || {};
  const items = [];
  if (s.github) items.push(socialItem("github", `https://github.com/${String(s.github).replace(/^@/, "")}`, "GitHub"));
  if (s.instagram) items.push(socialItem("instagram", `https://instagram.com/${String(s.instagram).replace(/^@/, "")}`, "Instagram"));
  if (s.linkedin) items.push(socialItem("linkedin", `https://linkedin.com/in/${String(s.linkedin).replace(/^@/, "")}`, "LinkedIn"));
  if (s.twitter) items.push(socialItem("twitter", `https://x.com/${String(s.twitter).replace(/^@/, "")}`, "Twitter/X"));
  if (s.email) items.push(socialItem("email", `mailto:${s.email}`, "Email"));
  return items.length ? `<div class="social" aria-label="Sosial dan email">${items.join("")}</div>` : "";
}

function normalizeMenuItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    label: String(item && item.label ? item.label : "").trim(),
    url: String(item && item.url ? item.url : "#").trim() || "#",
    children: normalizeMenuItems(item && item.children),
  })).filter((item) => item.label);
}

function renderHeaderMenu(items, U) {
  const menu = normalizeMenuItems(items);
  return menu.map((item) => {
    const children = normalizeMenuItems(item.children);
    if (!children.length) return `<a class="nav-link" href="${attr(U.url(item.url))}">${esc(item.label)}</a>`;
    const childLinks = children.map((child) => `<a href="${attr(U.url(child.url))}">${esc(child.label)}</a>`).join("");
    return `<div class="nav-item-wrap has-submenu">
      <a class="nav-link" href="${attr(U.url(item.url))}">${esc(item.label)}</a>
      <button class="submenu-toggle" type="button" aria-expanded="false" aria-label="Buka submenu ${attr(item.label)}">▾</button>
      <div class="submenu" role="menu">${childLinks}</div>
    </div>`;
  }).join("");
}

function renderFooterMenu(items, U) {
  const rawMenu = normalizeMenuItems(items);
  const fallback = normalizeMenuItems([
    { label: "Beranda", url: "/" },
    { label: "Tentang Kami", url: "/tentang-kami/" },
    { label: "Layanan", url: "/layanan/" },
    { label: "Blog", url: "/blog/" },
    { label: "Kontak", url: "/kontak/" },
  ]);
  const seen = new Set();
  const links = [];
  (rawMenu.length ? rawMenu : fallback).forEach((item) => {
    if (item.url) links.push({ label: item.label, url: item.url });
    normalizeMenuItems(item.children).forEach((child) => links.push({ label: child.label, url: child.url || "#" }));
    if (!item.url && !item.children.length && item.label) links.push({ label: item.label, url: "#" });
  });
  const menuLinks = links.filter((item) => {
    const key = `${item.label}|${item.url}`;
    if (!item.label || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return `<div class="footer-menu-single"><h3>Menu</h3><nav class="footer-menu-list" aria-label="Menu footer">${menuLinks.map((item) => `<a href="${attr(U.url(item.url))}">${esc(item.label)}</a>`).join("")}</nav></div>`;
}

function header(config, U, site) {
  const navItems = renderHeaderMenu(config.nav || [], U);
  const wa = whatsappUrl(site, "Halo GudangWeb, saya ingin konsultasi pembuatan website.");
  return `
  <header class="site-header">
    <div class="container header-inner">
      ${logoMarkup(config, U, "site-logo")}
      <nav class="site-nav" id="site-nav" aria-label="Menu utama">${navItems}</nav>
      <div class="header-actions">
        <a class="header-cta" href="${attr(wa)}">Konsultasi</a>
        <button class="mobile-nav-toggle" type="button" aria-label="Buka menu" aria-controls="site-nav" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>`;
}

function footer(config, U, site) {
  const year = new Date().getFullYear();
  const company = site.company || {};
  const footerCfg = config.footer || {};
  const fallbackCopyright = `© ${year} ${config.author || config.title}. ${config.footerText || ""}`.trim();
  const copyrightText = String(footerCfg.copyrightText || fallbackCopyright).replace(/\{year\}/g, year);
  const creditText = footerCfg.creditText || "Build with gitcompro";
  const creditUrl = footerCfg.creditUrl || "https://www.gudangweb.com";
  const creditMarkup = creditText
    ? (creditUrl ? `<a class="footer-credit" href="${attr(creditUrl)}" target="_blank" rel="noopener">${esc(creditText)}</a>` : `<span class="footer-credit">${esc(creditText)}</span>`)
    : "";
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        ${logoMarkup(config, U, "footer-logo")}
        <p class="footer-desc">${esc(company.description || config.description || "")}</p>
        ${socialLinks(config)}
      </div>
      ${renderFooterMenu(config.footerMenu || [], U)}
      <div>
        <h3>Kontak</h3>
        <p>${esc(company.phone || "")}</p>
        <p>${esc(company.email || "")}</p>
        <p>${esc(company.address || "")}</p>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>${esc(copyrightText)}</span>
      ${creditMarkup}
    </div>
  </footer>`;
}


function isTruthySetting(value, fallback = true) {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return !/^(false|0|no|tidak|off)$/i.test(String(value).trim());
}
function mobileMenuScript() {
  return `<script>
(function(){
  var header=document.querySelector('.site-header');
  var toggle=document.querySelector('.mobile-nav-toggle');
  var nav=document.querySelector('.site-nav');
  if(!header||!toggle||!nav)return;
  function closeSubmenus(){
    nav.querySelectorAll('.has-submenu.submenu-open').forEach(function(item){item.classList.remove('submenu-open');});
    nav.querySelectorAll('.submenu-toggle').forEach(function(btn){btn.setAttribute('aria-expanded','false');});
  }
  function setMenu(open){
    header.classList.toggle('nav-open',open);
    document.body.classList.toggle('nav-open',open);
    toggle.setAttribute('aria-expanded',open?'true':'false');
    toggle.setAttribute('aria-label',open?'Tutup menu':'Buka menu');
    if(!open)closeSubmenus();
  }
  toggle.addEventListener('click',function(){setMenu(!header.classList.contains('nav-open'));});
  nav.querySelectorAll('.submenu-toggle').forEach(function(btn){
    btn.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      var parent=btn.closest('.has-submenu');
      if(!parent)return;
      var open=!parent.classList.contains('submenu-open');
      parent.classList.toggle('submenu-open',open);
      btn.setAttribute('aria-expanded',open?'true':'false');
    });
  });
  nav.querySelectorAll('a').forEach(function(link){link.addEventListener('click',function(){setMenu(false);});});
  document.addEventListener('keydown',function(event){if(event.key==='Escape')setMenu(false);});
  document.addEventListener('click',function(event){if(header.classList.contains('nav-open')&&!header.contains(event.target))setMenu(false);});
  window.addEventListener('resize',function(){if(window.innerWidth>980)setMenu(false);});
})();
</script>`;
}

function floatingWhatsapp(site) {
  const fw = site.floatingWhatsapp || {};
  if (!isTruthySetting(fw.enabled, true)) return "";
  const label = fw.label || "Chat WhatsApp";
  const message = fw.message || "Halo GudangWeb, saya ingin konsultasi pembuatan website dan SEO.";
  const href = whatsappUrl(site, message);
  if (!href || href === "/kontak/") return "";
  return `<a class="floating-whatsapp" href="${attr(href)}" target="_blank" rel="noopener" aria-label="${attr(label)}" title="${attr(label)}">
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.03 3.2c-7.02 0-12.73 5.7-12.73 12.72 0 2.24.59 4.43 1.72 6.35L3.2 28.8l6.68-1.75a12.68 12.68 0 0 0 6.14 1.56h.01c7.01 0 12.72-5.71 12.72-12.73S23.04 3.2 16.03 3.2Zm0 23.26h-.01c-1.96 0-3.88-.53-5.55-1.53l-.4-.24-3.96 1.04 1.06-3.86-.26-.4a10.54 10.54 0 0 1-1.61-5.55c0-5.87 4.78-10.65 10.66-10.65 2.84 0 5.51 1.11 7.52 3.12a10.59 10.59 0 0 1 3.12 7.52c0 5.87-4.78 10.65-10.57 10.65Zm5.84-7.98c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.15 3.09 1.31 3.3c.16.21 2.26 3.45 5.47 4.84.76.33 1.36.52 1.82.67.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z"/></svg>
    <span>${esc(label)}</span>
  </a>`;
}

function baseLayout(opts) {
  const { config, U, site } = opts;
  const siteName = esc(config.title);
  const title = opts.title ? `${esc(opts.title)} — ${siteName}` : `${siteName} — ${esc(config.tagline || "")}`;
  const desc = attr(opts.description || config.description || "");
  const canonical = attr(opts.canonical || U.baseUrl + "/");
  const ogType = opts.ogType || "website";
  const ogImage = opts.ogImage ? attr(opts.ogImage) : (config.defaultOgImage ? attr(U.abs(config.defaultOgImage)) : "");
  const jsonLd = opts.jsonLd ? `\n  <script type="application/ld+json">${opts.jsonLd}</script>` : "";
  const ogImageTags = ogImage ? `\n  <meta property="og:image" content="${ogImage}">\n  <meta name="twitter:image" content="${ogImage}">` : "";
  const branding = config.branding || {};
  const favicon = branding.favicon ? attr(U.url(branding.favicon)) : "";
  const faviconTags = favicon ? `\n  <link rel="icon" href="${favicon}">\n  <link rel="shortcut icon" href="${favicon}">\n  <link rel="apple-touch-icon" href="${favicon}">` : "";
  const themeColor = attr(safeColor((config.theme || {}).primaryColor, "#155eef"));

  return `<!DOCTYPE html>
<html lang="${attr(config.language || "id")}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="${themeColor}">${faviconTags}
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${attr(opts.title || config.title)}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="${siteName}">${ogImageTags}
  <meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
  <link rel="alternate" type="application/rss+xml" title="${siteName}" href="${attr(U.url("/rss.xml"))}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${attr(U.url("/theme/style.css"))}">
  ${themeStyle(config)}${jsonLd}
</head>
<body>
${header(config, U, site)}
  <main class="site-main">
${opts.content}
  </main>
${footer(config, U, site)}
${mobileMenuScript()}
${floatingWhatsapp(site)}
</body>
</html>`;
}

function serviceCard(item, U) {
  return `<article class="service-card">
    <div class="service-icon">✦</div>
    <h3>${esc(item.title)}</h3>
    <p>${esc(item.text)}</p>
    ${item.url ? `<a href="${attr(U.url(item.url))}">Pelajari layanan →</a>` : ""}
  </article>`;
}

function ctaBlock(cta, site) {
  if (!cta) return "";
  const company = site.company || {};
  const eyebrow = cta.eyebrow || "Konsultasi";
  const message = cta.whatsappMessage || "Halo GudangWeb, saya ingin konsultasi website dan SEO.";
  const highlights = Array.isArray(cta.highlights) && cta.highlights.length ? cta.highlights : ["Konsultasi kebutuhan", "Arahan struktur website", "Rencana SEO dasar"];
  return `<section class="section section-cta section-cta-premium">
    <div class="container cta-premium-box">
      <div class="cta-glow cta-glow-one"></div>
      <div class="cta-glow cta-glow-two"></div>
      <div class="cta-content">
        <span class="eyebrow">${esc(eyebrow)}</span>
        <h2>${esc(cta.title)}</h2>
        <p>${esc(cta.text)}</p>
        <div class="cta-highlights">${highlights.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
      </div>
      <div class="cta-action-card">
        <span class="cta-action-label">${esc(cta.cardLabel || "Siap dibantu GudangWeb")}</span>
        <strong>${esc(company.phone || "WhatsApp GudangWeb")}</strong>
        <p>${esc(cta.note || "Kirim brief singkat, jenis bisnis, dan target halaman yang dibutuhkan.")}</p>
        <a class="btn btn-light cta-main-btn" href="${attr(whatsappUrl(site, message))}">${esc(cta.button || "Hubungi Kami")}</a>
      </div>
    </div>
  </section>`;
}

function homeTemplate({ posts, config, U, site }) {
  const home = site.home || {};
  const hero = home.hero || {};
  const services = (site.services && site.services.items) || [];
  const stats = Array.isArray(home.stats) ? home.stats : [];
  const process = Array.isArray(home.process) ? home.process : [];
  const intro = home.intro || {};
  const blog = home.blog || {};
  const articleLimit = Math.max(1, parseInt(blog.articleLimit, 10) || 3);
  const latestPosts = posts.slice(0, articleLimit);

  const content = `
    <section class="hero hero-home hero-photo"${bgStyle(hero.backgroundImage || hero.image, U, "--hero-bg")}>
      <div class="hero-shade"></div>
      <div class="container hero-home-inner">
        <div class="hero-copy hero-copy-wide">
          <span class="eyebrow">${esc(hero.eyebrow)}</span>
          <h1>${esc(hero.title || config.title)}</h1>
          <p>${esc(hero.subtitle || config.description)}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="${attr(whatsappUrl(site, "Halo GudangWeb, saya ingin konsultasi pembuatan website."))}">${esc(hero.primaryLabel || "Konsultasi")}</a>
            <a class="btn btn-outline btn-outline-light" href="${attr(U.url("/layanan/"))}">${esc(hero.secondaryLabel || "Lihat Layanan")}</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section stats-section">
      <div class="container stats-grid">
        ${stats.map((s) => {
          const icon = s.icon || s.image || "";
          const iconAlt = s.iconAlt || s.value || "Stat icon";
          const iconMarkup = icon ? `<div class="stat-icon">${imageHtml(icon, iconAlt, U)}</div>` : "";
          return `<div class="stat-card">${iconMarkup}<strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`;
        }).join("")}
      </div>
    </section>

    <section class="section">
      <div class="container intro-media-split">
        <figure class="section-image-card section-image-square">
          ${imageHtml(intro.image, intro.imageAlt || intro.title, U)}
        </figure>
        <div class="section-copy">
          <span class="eyebrow">${esc(intro.eyebrow)}</span>
          <h2>${esc(intro.title)}</h2>
          <div class="rich-text">${textToHtml(intro.text)}</div>
        </div>
      </div>
    </section>

    <section class="section section-soft">
      <div class="container section-head">
        <span class="eyebrow">Layanan</span>
        <h2>${esc(home.serviceTitle)}</h2>
        <p>${esc(home.serviceIntro)}</p>
      </div>
      <div class="container service-grid">${services.slice(0, 6).map((item) => serviceCard(item, U)).join("")}</div>
    </section>

    <section class="section">
      <div class="container section-head">
        <span class="eyebrow">Proses</span>
        <h2>${esc(home.processTitle)}</h2>
      </div>
      <div class="container process-grid">
        ${process.map((p, i) => `<article class="process-card"><span>0${i + 1}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></article>`).join("")}
      </div>
    </section>

    <section class="section section-soft home-blog-section">
      <div class="container section-head inline-head article-section-head">
        <div><span class="eyebrow">${esc(blog.eyebrow || "Blog")}</span><h2>${esc(blog.title || "Artikel Terbaru")}</h2><p>${esc(blog.description || "Insight seputar website, SEO, dan strategi digital untuk bisnis.")}</p></div>
        <a class="text-link" href="${attr(U.url("/blog/"))}">Lihat semua artikel →</a>
      </div>
      <div class="container post-grid">${latestPosts.map((p) => postCard(p, config, U)).join("")}</div>
    </section>
    ${faqSection(home.faq, { title: home.faqTitle, description: home.faqDescription, className: "home-faq" })}
    ${ctaBlock(home.cta, site)}
  `;

  const jsonLd = schemaGraph([
    organizationSchema(config, U, site),
    websiteSchema(config, U, site),
    professionalServiceSchema(config, U, site),
    webPageSchema(config, U.abs("/"), config.title, config.description, "WebPage"),
    faqSchema(home.faq),
  ]);

  return baseLayout({ config, U, site, title: "", description: config.description, canonical: U.baseUrl + "/", ogType: "website", jsonLd, content });
}

function standardHero(page, U, className = "") {
  const hero = page.hero || {};
  const hasImage = !!hero.image;
  const hasBg = !!hero.backgroundImage;
  return `<section class="page-hero ${hasBg ? "page-hero-photo" : ""} ${attr(className)}"${bgStyle(hero.backgroundImage, U, "--page-hero-bg")}>
    <div class="page-hero-shade"></div>
    <div class="container page-hero-grid ${hasImage ? "has-page-image" : ""}">
      <div class="page-hero-copy"><span class="eyebrow">${esc(hero.eyebrow)}</span><h1>${esc(hero.title)}</h1><p>${esc(hero.subtitle)}</p></div>
      ${hasImage ? `<figure class="page-hero-card">${imageHtml(hero.image, hero.imageAlt || hero.title, U)}</figure>` : ""}
    </div>
  </section>`;
}

function aboutTemplate({ config, U, site }) {
  const about = site.about || {};
  const content = `
    ${standardHero(about, U, "about-hero")}
    <section class="section"><div class="container media-split">
      <figure class="section-image-card">${imageHtml(about.image, about.imageAlt || about.storyTitle, U)}</figure>
      <div class="section-copy"><span class="eyebrow">Profil</span><h2>${esc(about.storyTitle)}</h2><div class="rich-text">${textToHtml(about.storyText)}</div></div>
    </div></section>
    <section class="section section-soft"><div class="container values-grid">${(about.values || []).map((v) => `<article><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></article>`).join("")}</div></section>
    <section class="section"><div class="container split-section"><div><span class="eyebrow">Keunggulan</span><h2>${esc(about.whyTitle)}</h2></div><ul class="check-list">${(about.whyList || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></section>
    ${faqSection(about.faq, { title: about.faqTitle, description: about.faqDescription, className: "about-faq" })}
    ${ctaBlock(about.cta || { title: "Ingin mengenal solusi GudangWeb lebih jauh?", text: "Kami siap membantu Anda merancang website company profile yang sesuai kebutuhan bisnis.", button: "Hubungi Kami" }, site)}
  `;
  const pageUrl = U.abs("/tentang-kami/");
  const jsonLd = schemaGraph([
    organizationSchema(config, U, site),
    webPageSchema(config, pageUrl, "Tentang Kami", about.hero?.subtitle || config.description),
    faqSchema(about.faq),
    breadcrumbSchema([{ name: "Beranda", url: U.abs("/") }, { name: "Tentang Kami", url: pageUrl }]),
  ]);
  return baseLayout({ config, U, site, title: "Tentang Kami", description: about.hero?.subtitle || config.description, canonical: pageUrl, jsonLd, content });
}

function servicesTemplate({ config, U, site }) {
  const services = site.services || {};
  const hasIntro = services.introTitle || services.introText || services.introImage;
  const introBlock = hasIntro ? `<section class="section"><div class="container media-split media-split-reverse">
      <div class="section-copy"><span class="eyebrow">${esc(services.introEyebrow || "Solusi Digital")}</span><h2>${esc(services.introTitle || "Layanan yang dapat disesuaikan dengan kebutuhan bisnis.")}</h2><div class="rich-text">${textToHtml(services.introText || "")}</div></div>
      <figure class="section-image-card">${imageHtml(services.introImage, services.introImageAlt || services.introTitle, U)}</figure>
    </div></section>` : "";
  const content = `
    ${standardHero(services, U, "services-hero")}
    ${introBlock}
    <section class="section section-soft"><div class="container service-grid service-grid-large">${(services.items || []).map((item) => serviceCard(item, U)).join("")}</div></section>
    ${faqSection(services.faq, { title: services.faqTitle, description: services.faqDescription, className: "services-faq" })}
    ${ctaBlock(services.cta, site)}
  `;
  const pageUrl = U.abs("/layanan/");
  const serviceItems = Array.isArray(services.items) ? services.items.filter((item) => item && item.title) : [];
  const jsonLd = schemaGraph([
    organizationSchema(config, U, site),
    webPageSchema(config, pageUrl, "Layanan", services.hero?.subtitle || config.description),
    serviceItems.length ? {
      "@type": "ItemList",
      name: "Daftar Layanan GudangWeb",
      itemListElement: serviceItems.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: { "@type": "Service", name: item.title, description: item.text, url: item.url ? U.abs(item.url) : pageUrl },
      })),
    } : null,
    faqSchema(services.faq),
    breadcrumbSchema([{ name: "Beranda", url: U.abs("/") }, { name: "Layanan", url: pageUrl }]),
  ]);
  return baseLayout({ config, U, site, title: "Layanan", description: services.hero?.subtitle || config.description, canonical: pageUrl, jsonLd, content });
}

function contactTemplate({ config, U, site }) {
  const contact = site.contact || {};
  const content = `
    ${standardHero(contact, U, "contact-hero")}
    <section class="section"><div class="container contact-grid">
      ${(contact.cards || []).map((c) => `<article class="contact-card"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>${c.url ? `<a href="${attr(c.url)}">Buka →</a>` : ""}</article>`).join("")}
    </div></section>
    <section class="section section-soft"><div class="container media-split">
      <figure class="section-image-card">${imageHtml(contact.image, contact.imageAlt || contact.noteTitle, U)}</figure>
      <div class="section-copy"><span class="eyebrow">Brief</span><h2>${esc(contact.noteTitle)}</h2><div class="rich-text">${textToHtml(contact.noteText)}</div></div>
    </div></section>
    ${faqSection(contact.faq, { title: contact.faqTitle, description: contact.faqDescription, className: "contact-faq" })}
    ${ctaBlock(contact.cta, site)}
  `;
  const pageUrl = U.abs("/kontak/");
  const jsonLd = schemaGraph([
    organizationSchema(config, U, site),
    webPageSchema(config, pageUrl, "Kontak", contact.hero?.subtitle || config.description, "ContactPage"),
    faqSchema(contact.faq),
    breadcrumbSchema([{ name: "Beranda", url: U.abs("/") }, { name: "Kontak", url: pageUrl }]),
  ]);
  return baseLayout({ config, U, site, title: "Kontak", description: contact.hero?.subtitle || config.description, canonical: pageUrl, jsonLd, content });
}

function postCard(post, config, U) {
  const cat = post.meta.category ? `<a href="${attr(U.url("/kategori/" + slugify(post.meta.category) + "/"))}" class="card-cat">${esc(post.meta.category)}</a>` : "";
  const cardAlt = post.featuredImageAlt || (U && typeof U.mediaAlt === "function" ? U.mediaAlt(post.featuredImage, post.meta.title) : post.meta.title);
  const img = post.featuredImage ? `<a href="${attr(U.url(post.permalink))}" class="card-thumb"><img src="${attr(U.url(post.featuredImage))}" alt="${attr(cardAlt)}" loading="lazy"></a>` : "";
  return `<article class="post-card${post.featuredImage ? " has-thumb" : ""}">${img}<div class="card-body">${cat}<h3 class="card-title"><a href="${attr(U.url(post.permalink))}">${esc(post.meta.title)}</a></h3><p class="card-excerpt">${esc(post.excerpt)}</p><div class="card-meta"><time datetime="${attr(post.meta.date)}">${esc(formatDate(post.meta.date, config.language))}</time><span>·</span><span>${post.readingTime} menit baca</span></div></div></article>`;
}

function blogIndexTemplate({ posts, pageNum, totalPages, config, U, site }) {
  const cards = posts.map((p) => postCard(p, config, U)).join("");
  let pagination = "";
  if (totalPages > 1) {
    const prev = pageNum > 1 ? `<a class="page-link" href="${attr(U.url(pageNum === 2 ? "/blog/" : "/blog/page/" + (pageNum - 1) + "/"))}">← Sebelumnya</a>` : `<span class="page-link disabled">← Sebelumnya</span>`;
    const next = pageNum < totalPages ? `<a class="page-link" href="${attr(U.url("/blog/page/" + (pageNum + 1) + "/"))}">Berikutnya →</a>` : `<span class="page-link disabled">Berikutnya →</span>`;
    pagination = `<nav class="pagination">${prev}<span>Halaman ${pageNum} dari ${totalPages}</span>${next}</nav>`;
  }
  const blogPage = site.blogPage || {};
  const hero = { hero: {
    eyebrow: blogPage.eyebrow || "Blog GudangWeb",
    title: blogPage.title || "Artikel Website, SEO, dan Digital Marketing",
    subtitle: blogPage.description || "Kumpulan artikel untuk membantu bisnis memahami website, konten, SEO, dan strategi online.",
    backgroundImage: blogPage.backgroundImage || "",
    image: blogPage.image || "",
    imageAlt: blogPage.imageAlt || "Blog GudangWeb"
  }};
  const content = `
    ${standardHero(hero, U, "blog-hero")}
    <section class="section"><div class="container post-grid">${cards}</div><div class="container">${pagination}</div></section>
    ${faqSection(blogPage.faq, { title: blogPage.faqTitle, description: blogPage.faqDescription, className: "blog-faq" })}`;
  const pageTitle = pageNum === 1 ? "Blog" : `Blog Halaman ${pageNum}`;
  const pageUrl = pageNum === 1 ? U.abs("/blog/") : U.abs("/blog/page/" + pageNum + "/");
  const jsonLd = schemaGraph([
    organizationSchema(config, U, site),
    webPageSchema(config, pageUrl, pageTitle, "Artikel website, SEO, dan digital marketing dari GudangWeb.", "CollectionPage"),
    pageNum === 1 ? faqSchema(blogPage.faq) : null,
    breadcrumbSchema([{ name: "Beranda", url: U.abs("/") }, { name: "Blog", url: U.abs("/blog/") }]),
  ]);
  return baseLayout({ config, U, site, title: pageTitle, description: "Artikel website, SEO, dan digital marketing dari GudangWeb.", canonical: pageUrl, jsonLd, content });
}

function blogSidebar(site, U) {
  const sb = site.blogSidebar || {};
  return `<aside class="blog-sidebar">
    <div class="sidebar-card sidebar-overlay-card">
      <span class="eyebrow">Layanan</span>
      <h3>${esc(sb.title || "Layanan")}</h3>
      <p>${esc(sb.intro || "")}</p>
      <div class="sidebar-links">${(sb.services || []).map((s) => `<a href="${attr(U.url(s.url || "/layanan/"))}">${esc(s.label)}</a>`).join("")}</div>
    </div>
    <div class="sidebar-card sidebar-contact">
      <h3>${esc(sb.contactTitle || "Kontak")}</h3>
      <p>${esc(sb.contactText || "")}</p>
      <a class="btn btn-primary btn-block" href="${attr(whatsappUrl(site, "Halo GudangWeb, saya membaca artikel dan ingin konsultasi website."))}">${esc(sb.button || "Chat WhatsApp")}</a>
    </div>
  </aside>`;
}

function postTemplate({ post, config, U, site, related }) {
  const cat = post.meta.category ? `<a href="${attr(U.url("/kategori/" + slugify(post.meta.category) + "/"))}" class="post-cat">${esc(post.meta.category)}</a>` : "";
  const tags = Array.isArray(post.meta.tags) && post.meta.tags.length ? `<div class="post-tags">${post.meta.tags.map((t) => `<a href="${attr(U.url("/tag/" + slugify(t) + "/"))}">#${esc(t)}</a>`).join("")}</div>` : "";
  const featuredAlt = post.featuredImageAlt || (U && typeof U.mediaAlt === "function" ? U.mediaAlt(post.featuredImage, post.meta.title) : post.meta.title);
  const featured = post.featuredImage ? `<figure class="post-featured"><img src="${attr(U.url(post.featuredImage))}" alt="${attr(featuredAlt)}"></figure>` : "";
  const relatedHtml = related && related.length ? `<section class="related"><h2>Artikel Lainnya</h2><div class="related-grid">${related.map((p) => `<a href="${attr(U.url(p.permalink))}" class="related-card"><strong>${esc(p.meta.title)}</strong><span>${esc(formatDate(p.meta.date, config.language))}</span></a>`).join("")}</div></section>` : "";
  const content = `
    <article class="post-detail">
      <div class="container post-title-wrap">
        ${cat}<h1>${esc(post.meta.title)}</h1>
        <div class="post-meta">${post.meta.author ? `<span>oleh ${esc(post.meta.author)}</span><span>·</span>` : ""}<time datetime="${attr(post.meta.date)}">${esc(formatDate(post.meta.date, config.language))}</time><span>·</span><span>${post.readingTime} menit baca</span></div>
      </div>
      ${featured}
      <div class="container content-with-sidebar">
        <div class="post-content">${post.html}${tags}${faqSection(post.meta.faq, { title: post.meta.faq_title || "FAQ Artikel", description: post.meta.faq_description || "Pertanyaan umum terkait topik artikel ini." })}${relatedHtml}</div>
        ${blogSidebar(site, U)}
      </div>
    </article>`;
  const pageUrl = U.abs(post.permalink);
  const blogPosting = {
    "@type": "BlogPosting",
    headline: post.meta.title,
    description: post.excerpt,
    datePublished: post.meta.date,
    dateModified: post.meta.modified || post.meta.date,
    author: (post.meta.author || config.author) ? { "@type": "Organization", name: post.meta.author || config.author } : undefined,
    publisher: { "@type": "Organization", name: config.title, logo: (config.branding || {}).logo ? { "@type": "ImageObject", url: U.abs((config.branding || {}).logo) } : undefined },
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    inLanguage: config.language || "id",
    image: post.ogImage || undefined,
  };
  const jsonLd = schemaGraph([
    organizationSchema(config, U, site),
    blogPosting,
    faqSchema(post.meta.faq),
    breadcrumbSchema([{ name: "Beranda", url: U.abs("/") }, { name: "Blog", url: U.abs("/blog/") }, { name: post.meta.title, url: pageUrl }]),
  ]);
  return baseLayout({ config, U, site, title: post.meta.title, description: post.excerpt, canonical: pageUrl, ogType: "article", ogImage: post.ogImage || "", jsonLd, content });
}

function archiveTemplate({ kind, term, posts, config, U, site }) {
  const label = kind === "kategori" ? "Kategori" : "Tag";
  const content = `${standardHero({ hero: { eyebrow: label, title: term, subtitle: `${posts.length} artikel ditemukan.` } }, U, "archive-hero")}<section class="section"><div class="container post-grid">${posts.map((p) => postCard(p, config, U)).join("")}</div></section>`;
  const pageUrl = U.abs("/" + kind + "/" + slugify(term) + "/");
  const jsonLd = schemaGraph([
    webPageSchema(config, pageUrl, `${label}: ${term}`, `Kumpulan artikel ${term} dari GudangWeb.`, "CollectionPage"),
    breadcrumbSchema([{ name: "Beranda", url: U.abs("/") }, { name: "Blog", url: U.abs("/blog/") }, { name: `${label}: ${term}`, url: pageUrl }]),
  ]);
  return baseLayout({ config, U, site, title: `${label}: ${term}`, description: `Kumpulan artikel ${term} dari GudangWeb.`, canonical: pageUrl, jsonLd, content });
}

function notFoundTemplate({ config, U, site }) {
  const content = `<section class="error-page container"><h1>404</h1><p>Halaman yang Anda cari tidak ditemukan.</p><a href="${attr(U.url("/"))}" class="btn btn-primary">Kembali ke Beranda</a></section>`;
  return baseLayout({ config, U, site, title: "404", description: "Halaman tidak ditemukan", content });
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function formatDate(dateStr, lang) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = (lang || "id") === "id" ? ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function redirectTemplate({ to, config, U, site }) {
  const target = U.url(to || "/");
  return `<!doctype html>
<html lang="${attr(config.language || "id")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${attr(target)}">
  <link rel="canonical" href="${attr(U.abs(to || "/"))}">
  <title>Redirecting...</title>
</head>
<body>
  <p>Halaman dipindahkan ke <a href="${attr(target)}">${esc(target)}</a>.</p>
</body>
</html>`;
}

module.exports = {
  makeUrlHelpers,
  baseLayout,
  homeTemplate,
  aboutTemplate,
  servicesTemplate,
  contactTemplate,
  blogIndexTemplate,
  postTemplate,
  archiveTemplate,
  notFoundTemplate,
  redirectTemplate,
  slugify,
  formatDate,
  esc,
  attr,
};
