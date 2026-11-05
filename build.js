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
const literatura = readJSON('data/literatura.json');
const recursos = readJSON('data/recursos.json');

function readJSON(rel) { return JSON.parse(fs.readFileSync(path.join(SRC, rel), 'utf8')); }
function read(rel) { return fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r\n?/g, '\n'); }   // sempre LF: o Git no Windows pode trazer CRLF
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

  const items = c.obras.map(o => `          <a href="${obraHref(root, o)}" class="mosaico-item" id="${c.id}-obra-${o.num}" data-lightbox data-num="${o.num}" data-title="${esc(o.titulo)}" data-meta="${esc(obraMeta(o))}">
            <div class="ph"><span class="ph-label">${o.num}</span></div>
          </a>`).join('\n');
  const index = c.obras.map(o => `          <a href="#${c.id}-obra-${o.num}">${o.num}</a>`).join('\n');
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

        <div class="mosaico reveal" data-n="${c.obras.length}">
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

/* ---------- literatura (contos, depois livros) ---------- */

const escritoHref = (root, e) => `${root}literatura/${e.slug}.html`;
const palavras = (e) => e.secoes.reduce((n, s) => n + s.paragrafos.join(' ').split(/\s+/).length, 0);
const minutosLeitura = (e) => Math.max(1, Math.round(palavras(e) / 200));

// imagem do escrito: usa o arquivo se já existir, senão o placeholder com o nome esperado
const existe = (rel) => rel && fs.existsSync(path.join(ROOT, rel));
function escritoImagem(root, e, label) {
  if (existe(e.imagem)) {
    return `<div class="ph escrito-imagem tem-imagem"><img src="${root}${e.imagem}" alt="" loading="lazy" decoding="async"></div>`;
  }
  return `<div class="ph escrito-imagem"><span class="ph-label">[ ${label} — ${e.imagem} ]</span></div>`;
}

// abertura da página do conto: o desenho largo de ponta a ponta (no celular, o vertical);
// shaders.js faz o desenho se formar no papel e depois se desfazer antes do texto
function escritoAbertura(root, e) {
  if (!existe(e.imagemLarga)) {
    return `<div class="wrap">${escritoImagem(root, e, 'imagem do conto')}</div>`;
  }
  const vertical = existe(e.imagem) ? `<source media="(max-width:700px)" srcset="${root}${e.imagem}">` : '';
  return `<div class="leitura-abertura">
      <div class="leitura-quadro">
        <picture>${vertical}<img src="${root}${e.imagemLarga}" alt="" decoding="async"></picture>
      </div>
    </div>`;
}

function renderLiteratura(root, h) {
  return literatura.escritos.map(e => `          <a class="escrito" href="${escritoHref(root, e)}">
            ${escritoImagem(root, e, 'imagem do conto')}
            <span class="escrito-meta">${e.num} · ${esc(e.tipo)} · ${minutosLeitura(e)} min de leitura</span>
            <${h} class="escrito-titulo">${esc(e.titulo)}</${h}>
            <p class="escrito-chamada">${esc(e.chamada)}</p>
            <span class="escrito-ler">conhecer o ${esc(e.tipo)} →</span>
          </a>`).join('\n');
}

// primeiras linhas do conto: os primeiros parágrafos até umas 80 palavras
// (o texto completo vai em PDF para quem assina a newsletter)
function renderTrecho(e) {
  const ps = [];
  let n = 0;
  for (const p of e.secoes[0].paragrafos) {
    ps.push(p);
    n += p.split(/\s+/).length;
    if (n >= 80) break;
  }
  return ps.map(p => `          <p>${esc(p)}</p>`).join('\n');
}

/* ---------- recursos para artistas (PDFs para baixar) ---------- */

function renderRecursos(root) {
  return recursos.arquivos.map(r => `          <a class="recurso reveal" href="${root}${r.arquivo}" download aria-label="Baixar ${esc(r.titulo)} (PDF, ${r.paginas} páginas)">
            <div class="recurso-linha">
              <span class="recurso-num" aria-hidden="true">${r.num}</span>
              <div class="recurso-texto">
                <h3 class="recurso-titulo">${esc(r.titulo)}</h3>
                <span class="recurso-sub">${esc(r.subtitulo)}</span>
                <span class="recurso-desc">${esc(r.descricao)}</span>
              </div>
              <span class="recurso-acao">
                <span class="btn recurso-baixar">baixar PDF ↓</span>
                <span class="recurso-meta">PDF · ${r.paginas} páginas</span>
              </span>
            </div>
          </a>`).join('\n');
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
      artMedium: o.tecnica,
      dateCreated: o.ano, description: o.descricao, isPartOf: { '@type': 'Collection', name: page.colecaoTitulo }
    };
  }
  if (kind === 'escrito') obj = {
    '@type': 'CreativeWork', genre: 'Conto', name: page.titulo, url: page.url, author: person,
    inLanguage: 'pt-BR', wordCount: palavras(page.escrito)
  };
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
  out = out.replace(/{{literatura(?::(h\d))?}}/g, (_, h) => renderLiteratura(vars.root, h || 'h4'));
  out = out.replace(/{{recursos}}/g, () => renderRecursos(vars.root));
  // portfólio no rodapé, igual ao mídia kit: vira download assim que portfolio.pdf existir na raiz
  // do projeto; até lá o link aparece, mas não responde (aria-disabled, ver script.js)
  out = out.replace(/{{portfolio}}/g, () => existe('portfolio.pdf')
    ? `<a href="${vars.root}portfolio.pdf" download>Portfólio (PDF) ↓</a>`
    : '<a href="#" aria-disabled="true">Portfólio (PDF) ↓</a>');
  // variáveis simples (escapadas), exceto as que já vêm prontas em HTML (jsonld, raw)
  out = out.replace(/{{(\w+)}}/g, (m, key) => {
    if (key === 'jsonld') return vars.jsonld;
    if (vars.raw && key in vars.raw) return vars.raw[key];
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

// uma página por escrito (texto completo)
// (a pasta também guarda as imagens dos contos: só os .html gerados são apagados)
const litDir = path.join(ROOT, 'literatura');
if (fs.existsSync(litDir)) {
  for (const f of fs.readdirSync(litDir)) if (f.endsWith('.html')) fs.rmSync(path.join(litDir, f));
}
const escritoTpl = read('pages/_escrito.html').replace(/^<!--escrito:[\s\S]*?-->\s*\n/, '');
literatura.escritos.forEach((e, i) => {
  const prox = literatura.escritos[(i + 1) % literatura.escritos.length];
  const vars = {
    ...e, escrito: e, nav: 'literatura', root: '../',
    minutos: String(minutosLeitura(e)),
    title: `${e.titulo} — conto de Augusto Tomba`,
    description: `${e.titulo}, ${e.tipo} de Augusto Tomba. ${e.chamada}`,
    ogType: 'article',
    url: site.url + `literatura/${e.slug}.html`,
    proxTitulo: prox.titulo, proxTipo: prox.tipo, proxHref: `${prox.slug}.html`,
    source: 'src/pages/_escrito.html',
    pdfHref: '../' + e.pdf,
    raw: { trecho: renderTrecho(e), abertura: escritoAbertura('../', e) }
  };
  vars.jsonld = jsonld('escrito', vars);
  write(`literatura/${e.slug}.html`, render(escritoTpl, vars, `_escrito.html (${e.slug})`));
  urls.push(vars.url);
});

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`);

console.log(`pronto: ${urls.length} páginas.`);
