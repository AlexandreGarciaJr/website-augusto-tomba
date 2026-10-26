# Site Augusto Tomba — Handoff para continuação no Claude Code

> Fonte da verdade: **os arquivos locais do usuário**. Ele editou HTML/CSS/JS à mão em vários pontos durante a conversa
> (criou `.ma2`, ajustou valores do parallax, trocou o `src` da imagem do hero para `./captura.jpg`).
> Não sobrescrever com versões antigas. `hero.html` é só um backup do usuário: **ignorar**.
> Os arquivos que o usuário reenviou ao final da conversa (`index.html`, `livro.html`, `quadros.html`, `quadro.html`, `script.js`)
> são **anteriores** às últimas rodadas (header reativo, parallax em camadas, textura de papel, lightbox, índice lateral).
> Ao começar no Claude Code, **ler primeiro o estado real do repositório** antes de editar qualquer coisa.

---

## 1. Contexto do projeto

Site pessoal de **Augusto Tomba**, artista visual (desenhos a carvão) e escritor. O projeto é conduzido pelo desenvolvedor
(Alexandre Junior) junto com o cliente (Augusto). A etapa atual é o **esboço de UI/UX para aprovação do layout**, com placeholders
no lugar de fotos e textos definitivos. É HTML + CSS + JS puros, sem framework e sem build.

### Briefing estético do Augusto (premissa inegociável)
- **Paleta quase monocromática**: fundo `#F2EFE9` (papel de arroz), texto `#2B2825`, único acento `#9B9189` (cinza-bege, tinta sumi),
  usado só em traços finos e separadores. **Nenhuma cor quente, nenhuma cor de destaque.**
- **Tipografia**: Shippori Mincho (títulos) + Spectral light (corpo). Garamond foi descartada de propósito.
- **Layout**: espaço em branco como material construtivo, margens largas, poucos elementos. A dobra inicial leva só nome, imagem e três palavras.
- **Navegação**: sem barra tradicional; menu discreto (três traços) com overlay.
- **Elemento de assinatura**: linha horizontal de 1px `#9B9189` entre seções, como pausa ("ma", o intervalo na estética japonesa).
- Inspiração oriental. O Augusto insiste em **não sobrecarregar**, porque as obras já carregam muito detalhe.
- O mesmo sistema estético será replicado depois no portfólio.

### Recomendações da editora (curso de marketing de livros da Dany Sakygawa, aulas "Site" e "Landing Page")
Landing page com banner, bio curta, foto atualizada, descrição dos livros, links de compra, captura de e-mail,
resenhas/depoimentos/avaliações, mídia kit (botão para PDF), contato, links de Instagram e Substack. **Responsivo.**
O Augusto disse que não precisa seguir exatamente os modelos de referência. As referências enviadas foram: Tonia Casarin,
Two Become One, What Matters (John Doerr), Ann Shoket, Tobias van Schneider, John Grisham, Queen Charlotte, Leigh Bardugo,
Miquel Reina e Rupi Kaur. Para o hero e o mosaico, a referência visual principal é **Henrik Uldalen**: faixa de imagem de
ponta a ponta, nome abaixo, mosaico irregular de obras.

### Estrutura de páginas acordada
1. **Home** (`index.html`): hero, biografia (+ declaração de artista), vitrine do livro, coleções de quadros (mosaico), rodapé.
2. **Livro** (`livro.html`): banner, descrição, compra, depoimentos, próximos livros, newsletter.
3. **Quadros** (`quadros.html`): listagem de obras.
4. **Quadro** (`quadro.html`): template de obra individual (ficha técnica + descrição).

---

## 2. Arquivos e design system

`index.html`, `livro.html`, `quadros.html`, `quadro.html`, `styles.css`, `script.js` (uma folha de estilo e um script para todas as páginas).

**Tokens principais** (`:root` em `styles.css`): `--bg`, `--bg-tint` (acento a ~10% de opacidade, usado por `.tint` para alternar o fundo
das seções), `--text`, `--text-soft`, `--text-faint`, `--line`, `--line-soft`, `--placeholder-fill`, `--serif-display`, `--serif-body`,
`--maxw: 1180px`, `--gutter`, `--section-pad`, `--ease`, `--paper-noise` (textura, ver 3.8).

**Classes utilitárias**: `.wrap`, `.section`, `.tint`, `.eyebrow`, `.section-title`, `.lede`, `.cta`, `.btn`, `.ph` (placeholder de imagem,
com `.ratio-*`), `.ma` (linha de respiro animada), `.reveal`, `.reveal-left`, `.reveal-right`, `.delay`, `.stagger` (entrada em cascata dos filhos).

Há um **filtro SVG duotone** (`#duotone`) embutido em `index.html` que remapeia qualquer imagem para as três cores da paleta (usado na foto do hero).

---

## 3. O que foi construído

### 3.1 Home — Hero
Faixa de imagem **de ponta a ponta** (`.hero-image-band`, altura `min(76vh, 720px)`). O nome "Augusto Tomba" e a tagline
`[ palavra · palavra · palavra ]` ficam **dentro** da imagem, em texto claro sobre uma vinheta escura radial (`.hero-vignette`).
Abaixo da imagem fica só o indicador **"scroll"** (`.scroll-cue`), em cor mais escura para ficar legível.
A imagem atual é **placeholder** (começou como foto de bambu na neblina de banco de imagens; o usuário passou a usar `./captura.jpg` local).
Uma etiqueta `.hero-bg-label` avisa que a imagem é provisória.

**Parallax em camadas** (`script.js`, `updateParallax`): imagem, texto e filtro se movem em velocidades diferentes.
- Imagem: `translateY(-rect.top * 0.6)`, com `scale` até +8% e `blur` até 3px conforme avança. É a "dissolução", que faz eco à declaração de artista ("Antes do traço ou da palavra, a dissolução.").
- Texto (`.hero-image-content`): `translateY(-rect.top * 0.22)`, velocidade própria.
- Desejo do usuário, que mudou várias vezes: a imagem deve ficar **quase parada em relação aos olhos**, descendo só um pouco, com forte
  sensação de profundidade, como no site do Henrik Uldalen. **Nunca 100% fixa** (`background-attachment: fixed` foi testado e rejeitado).
  O usuário editou à mão `maxShift = height * 1` e fator `0.75`. Ver pendências em 5.

### 3.2 Header
`position: sticky`, fundo papel, wordmark "Augusto Tomba" à esquerda e menu de 3 traços à direita. Reage ao scroll (`initHeaderScroll`):
- após ~30px: `.is-scrolled` (encolhe, fundo translúcido com `backdrop-filter: blur(8px)`, borda fina);
- após ~140px rolando para baixo: `.is-hidden` (sai da tela); ao rolar para cima, volta;
- `::after` é uma **barra de progresso de leitura** (variável CSS `--scroll-progress`), com a cor e a espessura da linha "ma".

### 3.3 Menu
Overlay em tela cheia com itens em cascata (Início, Livro, Quadros, Contato). ESC fecha; `aria-expanded` no botão.

### 3.4 Biografia + Declaração de artista
Grid foto (placeholder) + texto. O parágrafo de bio **é do cliente** ("Augusto Tomba vive em São Paulo. Pinta com técnicas históricas,
sob luz de vela…"). A **declaração de artista** vem logo abaixo, separada por linha fina: abertura em Shippori Mincho, demais parágrafos
em Spectral itálico. Ela se alinha à coluna de texto do bio-grid (bug corrigido: havia `calc(minmax(...))`, que é inválido; agora
`calc(260px + clamp(...))`).

### 3.5 Literatura
Vitrine do livro (capa e título ainda placeholder) com link para `livro.html`.

### 3.6 Coleções de quadros (home)
Seção `.section-colecoes` com:
- título "Coleções" + **jump-links** entre coleções (`.colecoes-index`; a coleção 02 está `aria-disabled`);
- **Coleção 01 · Primitivo Onipresente** (textos reais do cliente): cabeçalho (número, título, descrição curta); depois um bloco de
  **introdução literária** (`.colecao-intro`: frase de abertura em Mincho com `position: sticky` à esquerda, corpo em Spectral itálico à direita,
  ficha técnica "Carvão sobre papel de aquarela 300 g/m² · 2026" no fim);
- **Mosaico irregular de 20 obras** (`.mosaico`): CSS Grid de 8 colunas, linhas de 38px, `grid-auto-flow: row dense`, com
  `grid-column`/`grid-row: span N` definidos item a item via `:nth-child()`. Contido (`max-width: var(--maxw)`, margens laterais), gap de 3px.
  Cai para 6 e 4 colunas em telas menores. Cada item tem `id="obra-NN"` e `data-lightbox`;
- placeholder da **Coleção 02**.

### 3.7 Funcionalidades da rodada "v2"
- **Skip-link** ("Pular para o conteúdo") + `id="main-content"` em todas as páginas.
- **Transição entre páginas**: overlay `.page-transition` (fade de ~420ms). O `href` é lido **no momento do clique**.
- **Lightbox de obra** (mosaico em `index.html` e cards em `quadros.html`): número, título, técnica, setas anterior/próxima, ESC e clique fora fecham,
  devolve o foco a quem abriu, link para a página da obra. Lê `data-num`, `data-title`, `data-meta`, `data-href`.
- **Índice lateral do mosaico** (`.mosaico-index`): números 01–20 fixos à direita, visível só com o mosaico em tela, destaca a obra atual
  (IntersectionObserver) e rola com flash na borda. Oculto abaixo de 1240px.
- Links `aria-disabled` recebem `tabindex=-1` e `preventDefault`.
- `prefers-reduced-motion` respeitado em CSS e JS.

### 3.8 Textura de papel
Variável `--paper-noise` (SVG `feTurbulence` em data-URI, sem imagem externa), aplicada como segunda camada de `background-image` em `body`
(`background-attachment: fixed`, `background-blend-mode: multiply`), no `.menu-overlay` e no `.lightbox-panel`. A primeira tentativa
(`body::before` com `z-index:-1`, alfa 0.05) ficou imperceptível; foi trocada por camada de background com `slope='0.14'`.
**O resultado visual ainda não foi confirmado** (ver 5).

### 3.9 Outras páginas
- `livro.html`: banner com capa, descrição, botões de compra, depoimentos (stagger), próximos livros, newsletter. Tudo placeholder.
- `quadros.html`: ainda usa a **grade antiga de 6 cards** (`.grid-quadros`), com lightbox. **Não foi migrada para o modelo de coleções + mosaico da home.**
- `quadro.html`: template único de obra (imagem, ficha técnica, descrição, "consultar disponibilidade").
- Rodapé global: navegação, Instagram, Substack, mídia kit (PDF), e-mail, newsletter (sem envio real, só feedback visual "Recebido").
- Badge fixo "esboço · ui/ux · v1" no canto: **remover antes de entregar**.

---

## 4. Decisões de design já tomadas (não reverter sem o usuário pedir)
- Hero com **nome dentro da imagem** e só o "scroll" fora (ele pediu isso depois de ter o nome abaixo).
- A imagem do hero **não é uma obra**; é algo que remeta à estética oriental, de ponta a ponta, com parallax.
- **Sem three.js**: foi proposto um canvas de tinta, depois removido; three.js foi descartado por brigar com o conceito de "ma".
  Reavaliar só se o cliente pedir interação mais rica.
- Mosaico **contido** (com margens laterais), nunca de borda a borda, com formas **bem irregulares** (larguras e alturas variadas).
- O texto de introdução da coleção fica **antes dos quadros**, separado do texto de abertura da coleção.
- Seções de coleções e rodapé usam o fundo `.tint` para alternar; o placeholder da coleção 02 também.
- O usuário prefere ajustes cirúrgicos: **mexer só no que foi pedido** (ele reclamou quando alterei mais do que o solicitado).

---

## 5. Pendências, riscos e o que NÃO foi verificado

Não havia navegador funcional no meu ambiente, então **nada foi validado visualmente por mim**. Pontos que precisam de verificação real
(Playwright / navegador):

1. **Textura de papel**: a primeira versão ficou imperceptível; a versão corrigida não teve retorno. Conferir intensidade (`slope='0.14'`).
2. **Parallax**: com `maxShift = altura * 1` e fator alto, a imagem pode **descobrir um vão no topo da faixa**, porque só tem ~7% de folga
   (`top:-7%`, `height:114%`). E `filter: blur() url(#duotone)` recalculado a cada frame é **caro**; considerar pré-renderizar a imagem já
   em duotone e animar só `transform`/`opacity`.
3. **Transição de página**: ao voltar pelo botão do navegador (bfcache), o overlay pode ficar opaco e a página parecer em branco.
   Falta handler de `pageshow` para resetar. Se o JS falhar, o overlay começa opaco e bloqueia a tela.
4. **Header que se esconde**: o botão do menu some junto; avaliar mantê-lo acessível.
5. **`.ma2` e `.tint`**: o usuário criou `.ma2` (linha de separação local). Sugeri por texto trocar a animação de `width` por `clip-path`
   (`inset(0 100% 0 0)` → `inset(0 0 0 0)`) e tornar `.tint` independente de `.section`. **Não sei o estado final no arquivo dele.** Verificar.
6. **Licença das imagens de banco** usadas como placeholder: chamei de "livres de direitos" sem ter confirmado a licença.
   Não publicar nenhuma; substituir por obras do Augusto ou imagens licenciadas.
7. **Contraste**: textos em `--text-faint` (rodapé, labels) estão no limite de legibilidade; medir contra WCAG AA.
8. **Responsivo**: mosaico (spans), `.colecao-intro` com coluna sticky, lightbox e header precisam de teste em 360–414px e tablet.
9. **Lightbox**: sem focus trap completo e sem swipe no mobile.

---

## 6. Próximos passos sugeridos

**Conteúdo (depende do cliente)**: foto atualizada do Augusto, imagem/vídeo do hero, tagline de 3 palavras, título/capa/sinopse do livro,
links de compra, depoimentos reais, PDF do mídia kit, links reais de Instagram/Substack/e-mail, fotos das 20 obras (título, técnica,
dimensões, disponibilidade).

**Estrutura**
- Migrar `quadros.html` para o modelo de coleções + mosaico (hoje diverge da home).
- Dar a cada obra sua própria página/slug (hoje todas apontam para `quadro.html`) e gerar o lightbox a partir de dados (JSON ou front matter), em vez de `data-*` escritos à mão.
- Extrair header/footer/menu duplicados nos 4 HTMLs; avaliar um gerador estático leve (Astro/Eleventy) ou includes.
- Integrar a newsletter de verdade (Substack ou provedor) e o botão do mídia kit.
- SEO e compartilhamento: `<title>`/`description` por página, Open Graph, favicon, sitemap, JSON-LD (Person/Book/VisualArtwork).

**Qualidade**
- `<img>` reais com `srcset`, `loading="lazy"`, dimensões explícitas (evitar layout shift) e duotone pré-processado.
- Teste visual automatizado com screenshots em vários viewports e posições de scroll.
- Auditoria de performance (Lighthouse) e de acessibilidade.

**Refino de motion** (só depois do conteúdo final): stagger do mosaico, título por palavra, cursor customizado.
Recomendação já dada ao usuário: manter o foco do cliente na aprovação do layout, sem sobrecarregar de efeitos.

---

## 7. Skills que podem ser úteis agora

Disponíveis nesta conta e que não existiam quando o site foi criado (confirmar com `ListSkills`):
- **`playwright-visual-qa`**: o que mais faltou. Validar textura, parallax, header e responsividade com screenshots reais.
- **`impeccable`** (critique/audit/polish/harden/adapt) e **`design-taste-frontend`**: revisão crítica de hierarquia, espaçamento, tipografia e UX copy, **respeitando a paleta restrita do Augusto**.
- **`motion-skill`** e **`awwwards-experience`**: refinar parallax e transições. Atenção: o conceito é "ma" e minimalismo, não efeito gratuito nem estética genérica.
- **`mobile-skill`**: adaptar parallax, mosaico e header para mobile.
- **`frontend-design`**: consistência do sistema de design.
- **`design:accessibility-review`** e **`design:design-critique`**: contraste, teclado, leitores de tela.
- **`design:ux-copy`**: microcopy ("Recebido", "consultar disponibilidade", labels).
- **`img-to-html`**, **`sites-incriveis`**, **`3d-skill`**: só se o cliente pedir algo além do escopo atual.
