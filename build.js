// AUGUSTO TOMBA — gerador estático mínimo (sem dependências)
// Monta as páginas de src/pages com os partials de src/partials, gera o mosaico,
// o lightbox e uma página por obra a partir de src/data/obras.json, e escreve
// sitemap.xml. A saída continua sendo HTML puro na raiz do projeto.
//
// Uso: node build.js

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const site = readJSON('data/site.json');
const data = readJSON('data/obras.json');

function readJSON(rel) { return JSON.parse(fs.readFileSync(path.join(SRC, rel), 'utf8')); }
function read(rel) { return fs.readFileSync(path.join(SRC, rel), 'utf8'); }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log('  ' + rel);
}

/* ---------- coleções + mosaico ---------- */

const obraHref = (root, obra) => `${root}obras/${obra.slug}.html`;
const obraMeta = (obra) => `${obra.tecnica}, ${obra.ano}`;

function renderColecoesIndex() {
  const links = data.colecoes.map(c => c.placeholder
    ? `          <a href="#${c.id}" aria-disabled="true">${c.num} · Próxima coleção</a>`
    : `          <a href="#${c.id}">${c.num} · ${esc(c.titulo)}</a>`);
  return `        <nav class="colecoes-index reveal" aria-label="Navegar entre coleções">\n${links.join('\n')}\n        </nav>`;
}

function renderColecao(c, { root, h, cta }) {
  if (c.placeholder) {
    return `
      <div class="wrap">
        <div class="ma"></div>
      </div>

      <!-- Placeholder coleção futura -->
      <div class="section" id="${c.id}">
        <div class="wrap">
          <div class="colecao-placeholder reveal">
            <span class="colecao-num" aria-hidden="true">${c.num}</span>
            <${h} class="colecao-title" style="color:var(--text-faint); font-style:italic;">${esc(c.titulo)}</${h}>
            <p class="colecao-desc" style="color:var(--text-faint);">${esc(c.desc)}</p>
          </div>
        </div>
      </div>`;
  }

  const items = c.obras.map(o => `          <a href="${obraHref(root, o)}" class="mosaico-item" id="obra-${o.num}" data-lightbox data-num="${o.num}" data-title="${esc(o.titulo)}" data-meta="${esc(obraMeta(o))}">
            <div class="ph"><span class="ph-label">${o.num}</span></div>
          </a>`).join('\n');
  const index = c.obras.map(o => `          <a href="#obra-${o.num}">${o.num}</a>`).join('\n');
  const intro = c.intro.map(p => `                <p>${esc(p)}</p>`).join('\n');

  return `
      <!-- Coleção ${c.num} -->
      <div class="colecao" id="${c.id}">
        <div class="wrap">

          <!-- Cabeçalho: número, título, descrição curta -->
          <div class="colecao-header reveal">
            <div class="colecao-header-left">
              <span class="colecao-num" aria-hidden="true">${c.num}</span>
              <${h} class="colecao-title">${esc(c.titulo)}</${h}>
              <p class="colecao-desc">${esc(c.desc)}</p>
            </div>
          </div>

          <!-- Introdução literária — antes do mosaico -->
          <div class="colecao-intro reveal">
            <p class="colecao-intro-abertura">${esc(c.introAbertura)}</p>
            <div class="colecao-intro-corpo">
${intro}
              <p class="colecao-meta">${esc(c.meta)}</p>
            </div>
          </div>

        </div>

        <div class="mosaico reveal">
${items}
        </div>

        <nav class="mosaico-index" aria-label="Índice de obras">
${index}
        </nav>
${cta ? `
        <div class="wrap">
          <a class="cta" href="${root}quadros.html">ver toda a coleção →</a>
        </div>` : ''}
      </div>`;
}

function renderColecoes(opts) {
  return data.colecoes.map(c => renderColecao(c, opts)).join('\n');
}

/* ---------- JSON-LD ---------- */

const person = {
  '@type': 'Person',
  name: site.nome,
  url: site.url,
  jobTitle: ['Artista visual', 'Escritor'],
  homeLocation: { '@type': 'Place', name: site.cidade }
};

function jsonld(kind, page) {
  let obj = null;
  if (kind === 'person') obj = { ...person, description: site.descricao };
  if (kind === 'book') obj = { '@type': 'Book', name: '[ Título do livro ]', inLanguage: 'pt-BR', author: person, url: page.url };
  if (kind === 'colecoes') obj = {
    '@type': 'CollectionPage', name: page.title, url: page.url, author: person,
    hasPart: data.colecoes.filter(c => !c.placeholder).map(c => ({
      '@type': 'Collection', name: c.titulo, description: c.desc,
      hasPart: c.obras.map(o => ({ '@type': 'VisualArtwork', name: o.titulo, url: site.url + `obras/${o.slug}.html` }))
    }))
  };
  if (kind === 'obra') {
    const o = page.obra;
    obj = {
      '@type': 'VisualArtwork', name: o.titulo, url: page.url, creator: person,
      artform: 'Desenho', artMedium: 'Carvão', artworkSurface: 'Papel de aquarela 300 g/m²',
      dateCreated: o.ano, description: o.descricao, isPartOf: { '@type': 'Collection', name: page.colecaoTitulo }
    };
  }
  if (!obj) return '';
  const json = JSON.stringify({ '@context': 'https://schema.org', ...obj }, null, 2).replace(/</g, '\\u003c');
  return `  <script type="application/ld+json">\n${json}\n  </script>`;
}

/* ---------- motor de template ---------- */

function render(template, vars, source) {
  let out = template;
  // partials: {{> nome}}
  for (let i = 0; i < 5 && /{{> *[\w-]+ *}}/.test(out); i++) {
    out = out.replace(/{{> *([\w-]+) *}}/g, (_, name) => read(`partials/${name}.html`).replace(/\n$/, ''));
  }
  // link do menu da página atual
  out = out.replace(/{{cur:(\w+)}}/g, (_, nav) => nav === vars.nav ? ' class="current"' : '');
  // blocos gerados a partir dos dados
  out = out.replace(/{{colecoes-index}}/g, () => renderColecoesIndex());
  out = out.replace(/{{colecoes(?::(h\d))?}}/g, (_, h) => renderColecoes({ root: vars.root, h: h || 'h3', cta: !h }));
  // variáveis simples (escapadas), exceto jsonld que já vem pronto
  out = out.replace(/{{(\w+)}}/g, (m, key) => {
    if (key === 'jsonld') return vars.jsonld;
    if (!(key in vars)) throw new Error(`${source}: variável desconhecida ${m}`);
    return esc(vars[key]);
  });
  return out;
}

function pageMeta(src) {
  const m = src.match(/^<!--page\s*([\s\S]*?)-->\s*\n/);
  if (!m) return null;
  return { meta: JSON.parse(m[1]), body: src.slice(m[0].length) };
}

/* ---------- build ---------- */

console.log('gerando:');
const urls = [];

for (const file of fs.readdirSync(path.join(SRC, 'pages'))) {
  if (file.startsWith('_')) continue;
  const parsed = pageMeta(read(`pages/${file}`));
  if (!parsed) continue;
  const { meta, body } = parsed;
  const url = site.url + (meta.out === 'index.html' ? '' : meta.out);
  const vars = { ...meta, root: '', url, source: `src/pages/${file}` };
  vars.jsonld = jsonld(meta.jsonld, vars);
  write(meta.out, render(body, vars, file));
  urls.push(url);
}

// uma página por obra
fs.rmSync(path.join(ROOT, 'obras'), { recursive: true, force: true });
const obraTpl = read('pages/_obra.html').replace(/^<!--obra:[\s\S]*?-->\s*\n/, '');
for (const c of data.colecoes) {
  if (c.placeholder) continue;
  for (const o of c.obras) {
    const placeholderTitle = o.titulo.startsWith('[');
    const vars = {
      ...o, obra: o, nav: 'quadros', root: '../',
      colecaoId: c.id, colecaoTitulo: c.titulo,
      title: placeholderTitle ? `Obra ${o.num} · ${c.titulo} — Augusto Tomba` : `${o.titulo} — Augusto Tomba`,
      description: `${placeholderTitle ? `Obra ${o.num}` : o.titulo}, da coleção ${c.titulo}. ${o.tecnica}, ${o.ano}. Augusto Tomba.`,
      ogType: 'article',
      url: site.url + `obras/${o.slug}.html`,
      source: 'src/pages/_obra.html'
    };
    vars.jsonld = jsonld('obra', vars);
    write(`obras/${o.slug}.html`, render(obraTpl, vars, `_obra.html (${o.slug})`));
    urls.push(vars.url);
  }
}

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`);

console.log(`pronto: ${urls.length} páginas.`);
