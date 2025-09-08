const fs = require('fs');
const path = require('path');

function parseFrontMatter(content) {
  const fmRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(fmRegex);
  if (!match) return { data: {}, body: content };
  const raw = match[1];
  const body = match[2];
  const data = {};
  raw.split(/\n/).forEach(line => {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (value === 'true') value = true; else if (value === 'false') value = false; else if (/^".*"$/.test(value)) value = value.slice(1,-1);
      data[key] = value;
    }
  });
  return { data, body };
}

function tokenize(str) {
  return Array.from(new Set(
    (str || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9ğüşöçıİâêîûç\s]/gi, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && t.length < 40)
  ));
}

function buildWikiRecords(rootDir) {
  const dirs = [path.join(rootDir, 'wiki'), path.join(rootDir, 'en', 'wiki')].filter(d => fs.existsSync(d));
  const records = [];
  function walk(dir, lang) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, lang);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        if (e.name.toLowerCase() === 'index.md') continue; // skip hub index pages
        const rel = path.relative(rootDir, full).replace(/\\/g,'/');
        const content = fs.readFileSync(full, 'utf8');
        const { data, body } = parseFrontMatter(content);
        if (data.public === false) continue;
        const title = data.name || data.title || path.basename(e.name, '.md');
        const categoryParts = rel.split('/');
        let category = 'wiki';
        const wikiIndex = categoryParts.indexOf('wiki');
        if (wikiIndex !== -1 && categoryParts.length > wikiIndex + 1) {
          category = categoryParts[wikiIndex + 1];
        }
        const slug = data.slug || title.toLowerCase().replace(/[^a-z0-9]+/gi,'-');
        const url = lang === 'en' ? `/en/wiki/${category}/${slug}/` : `/wiki/${category}/${slug}/`;
        const summary = data.summary || body.trim().split(/\n+/).find(l=>l.length>0)?.slice(0,180) || '';
        const tokens = tokenize(title + ' ' + summary);
        records.push({
          id: `wiki:${slug}:${lang}`,
          type: 'wiki',
          category,
          lang,
          title,
          summary,
          url,
          tokens
        });
      }
    }
  }
  for (const d of dirs) {
    const lang = d.includes(`${path.sep}en${path.sep}`) ? 'en' : 'tr';
    walk(d, lang);
  }
  return records;
}

function buildMarkerRecords(rootDir) {
  const sources = [
    path.join(rootDir, 'data', 'markers.json'),
    path.join(rootDir, 'map', 'data', 'markers.json')
  ];
  const byId = new Map();
  for (const p of sources) {
    if (!fs.existsSync(p)) continue;
    try {
      const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (obj && Array.isArray(obj.markers)) {
        for (const m of obj.markers) {
          // Prefer earlier source (root/data) if duplicate id appears later
          if (!byId.has(m.id)) byId.set(m.id, m);
        }
      }
    } catch {}
  }
  if (byId.size === 0) return [];
  return Array.from(byId.values()).filter(m => m.public !== false).map(m => {
    const title = m.name || m.id;
    const summary = m.summary || '';
    const tokens = tokenize(title + ' ' + m.id + ' ' + summary + ' ' + (m.faction||'') + ' ' + (m.type||''));
    return {
      id: `marker:${m.id}`,
      type: 'marker',
      category: m.type || 'marker',
      lang: 'neutral',
      title,
      summary,
      url: `/map/?focus=${encodeURIComponent(m.id)}`,
      tokens
    };
  });
}

module.exports = function() {
  const rootDir = process.cwd();
  const wiki = buildWikiRecords(rootDir);
  const markers = buildMarkerRecords(rootDir);
  return [...wiki, ...markers];
};
