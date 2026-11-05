// AUGUSTO TOMBA — shaders (WebGL puro, sem bibliotecas)
// 1. Hero: a imagem se dissolve em grão de carvão conforme a rolagem e,
//    sob o cursor (ou o dedo), ondula como tinta em papel molhado.
// (a fumaça do manifesto é uma simulação de fluido e fica em fumaca.js)
// Sem WebGL ou com movimento reduzido, nada disso roda e fica o site estático.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const PAPER = 'const vec3 PAPER = vec3(.949,.937,.914); const vec3 INK = vec3(.169,.157,.145);';
  const NOISE = `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }`;
  const VERT = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }';

  // cria um canvas WebGL com um único quad e o fragment shader dado
  function createGL(canvas, frag) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) return null;
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uniforms = {};
    const u = name => (name in uniforms ? uniforms[name] : (uniforms[name] = gl.getUniformLocation(prog, name)));
    return { gl, u };
  }

  function fit(canvas, scale) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
    return false;
  }

  /* ---------- 1. hero: dissolução + tinta ---------- */
  (function hero() {
    const band = document.querySelector('.hero-image-band');
    const parallax = document.querySelector('.hero-parallax');
    const img = parallax && parallax.querySelector('.hero-photo');
    if (!band || !img) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-gl';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = createGL(canvas, `precision highp float; varying vec2 vUv;
      uniform sampler2D uTex; uniform vec2 uRes, uM; uniform float uImgAsp, uP, uT, uS;
      ${PAPER} ${NOISE}
      vec2 cover(vec2 uv){ float a = uRes.x/uRes.y; vec2 s = a > uImgAsp ? vec2(1., uImgAsp/a) : vec2(a/uImgAsp, 1.); return (uv-.5)*s+.5; }
      void main(){
        vec2 asp = vec2(uRes.x/uRes.y, 1.);
        // tinta na água: perto do cursor a imagem ondula e a tinta se espalha
        vec2 d = (vUv - uM) * asp; float r = length(d);
        float fall = exp(-r*4.5) * uS;
        vec2 flow = vec2(fbm(vUv*asp*2.5 + uT*.12), fbm(vUv*asp*2.5 + 7.3 - uT*.1)) - .5;
        float ring = sin(r*38. - uT*3.) * exp(-r*7.) * uS;
        vec2 uv = vUv + flow*.14*fall + normalize(d + 1e-4)*ring*.016;
        vec3 img = texture2D(uTex, cover(uv)).rgb;
        float bleed = smoothstep(.45, .85, fbm(vUv*asp*5. + flow*2. + uT*.2)) * fall;
        img = mix(img, INK, bleed*.75);
        // dissolução em grão de carvão: o ruído decide a ordem em que cada ponto volta ao papel
        float n = fbm(vUv*asp*3.2 + uT*.015)*.78 + hash(floor(gl_FragCoord.xy/1.5))*.22;
        float th = mix(-.12, 1.05, uP);
        float keep = smoothstep(th, th + .06, n);
        float edge = smoothstep(th - .015, th + .015, n) * (1. - smoothstep(th + .015, th + .07, n));
        vec3 col = mix(PAPER, img, keep);
        col = mix(col, INK, edge*.55);
        col += (hash(gl_FragCoord.xy) - .5) * .03 * (1. - keep);   // o papel revelado tem o mesmo grão da página
        gl_FragColor = vec4(col, 1.);
      }`);
    if (!ctx) return;
    const { gl, u } = ctx;

    let texReady = false, visible = true, raf = 0;
    let progress = 0, strength = 0, target = 0, mx = .5, my = .5, t0 = performance.now();

    function upload() {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.uniform1f(u('uImgAsp'), img.naturalWidth / img.naturalHeight);
      texReady = true;
      parallax.appendChild(canvas);
      band.classList.add('has-gl');   // o CSS esconde as imagens estáticas
      // o hero passa a ficar preso enquanto a pintura se dissolve; só então a página desce
      const hero = band.closest('.hero');
      if (hero && hero.querySelector('.hero-pin')) {
        // altura do header acima do hero: o pin a devolve por dentro (ver styles.css)
        hero.style.setProperty('--pin-offset', hero.offsetTop + 'px');
        hero.classList.add('is-pinned');
      }
      window.dispatchEvent(new Event('scroll'));   // parallax e nome recalculam com o pin
      onScroll();
    }

    function frame(now) {
      raf = 0;
      if (!texReady || !visible) return;
      fit(canvas, 1);
      strength += (target - strength) * .06;   // a tinta chega devagar e assenta devagar
      target *= .965;
      const t = (now - t0) / 1000;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
      gl.uniform2f(u('uM'), mx, my);
      gl.uniform1f(u('uP'), Math.min(1, progress * 1.15));
      gl.uniform1f(u('uT'), t);
      gl.uniform1f(u('uS'), strength);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (strength > .002 || target > .002) request();   // só anima enquanto há tinta se mexendo
    }
    function request() { if (!raf) raf = requestAnimationFrame(frame); }

    function onScroll() {
      // mesmo progresso usado pelo parallax e pelo nome (script.js)
      progress = window.heroProgress
        ? window.heroProgress().progress
        : Math.min(1, Math.max(0, window.scrollY / (band.offsetHeight || 1)));
      request();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', request);
    band.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      my = 1 - (e.clientY - r.top) / r.height;
      target = 1;
      request();
    }, { passive: true });

    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) request(); }).observe(band);
    onScroll();
    if (img.complete && img.naturalWidth) upload(); else img.addEventListener('load', upload, { once: true });
  })();

  /* ---------- 4. abertura do conto: o título se desfaz, o desenho se forma ----------
     Título e desenho dividem a mesma tela. No primeiro gesto para baixo a página não
     desce: as letras do título se desfazem uma a uma e, no lugar delas, o desenho se
     forma em manchas de carvão, impresso no mesmo papel da página. O efeito acompanha
     a rolagem aos poucos (cada gesto avança um pouco, com um limite por gesto, então
     rolar rápido não pula nada); só quando o desenho está inteiro a página desce.
     De volta ao topo, rolar para cima faz o inverso. */
  (function leitura() {
    const palco = document.querySelector('.leitura-palco');
    const quadro = palco && palco.querySelector('.leitura-quadro');
    const img = quadro && quadro.querySelector('img');
    if (!img) return;
    const cabeca = palco.querySelector('.leitura-cabeca');
    const titulo = palco.querySelector('.leitura-titulo');

    const canvas = document.createElement('canvas');
    canvas.className = 'leitura-gl';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = createGL(canvas, `precision highp float; varying vec2 vUv;
      uniform sampler2D uTex; uniform vec2 uRes; uniform vec3 uWhite; uniform float uImgAsp, uForm;
      ${PAPER} ${NOISE}
      void main(){
        vec2 asp = vec2(uRes.x/uRes.y, 1.);
        // o desenho inteiro cabe no palco (contain), centrado; o resto é papel
        float a = uRes.x/uRes.y;
        vec2 s = a > uImgAsp ? vec2(a/uImgAsp, 1.) : vec2(1., uImgAsp/a);
        vec2 uv = (vUv - .5) * s + .5;
        float inside = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
        vec3 img = texture2D(uTex, clamp(uv, 0., 1.)).rgb;
        // o papel do desenho (uWhite, medido na própria imagem) vira o papel do site
        vec3 draw = mix(PAPER, PAPER * clamp(img / uWhite, 0., 1.), inside);
        // as bordas do desenho se desfazem no papel (sem corte reto onde a imagem acaba)
        vec2 e = smoothstep(0., .05, uv) * smoothstep(1., .95, uv);
        draw = mix(PAPER, draw, e.x * e.y);
        float ink = 1. - dot(draw, vec3(.333)) / dot(PAPER, vec3(.333));
        // a ordem em que cada ponto aparece: manchas largas de carvão com um grão fino
        // por cima (ruído contínuo, não por pixel — por pixel vira chuvisco de TV)
        float n = fbm(vUv*asp*2.6)*.8 + fbm(vUv*asp*38.)*.2;
        // o limiar percorre a faixa em que o ruído de fato vive (~.15–.7), para o desenho
        // ir aparecendo ao longo de toda a rolagem, e não só no fim
        float th = mix(.64, .16, uForm);
        float keep = smoothstep(th, th + .06, n);
        float edge = smoothstep(th - .015, th + .015, n) * (1. - smoothstep(th + .015, th + .07, n));
        // em 0 o papel está liso: os picos do ruído não podem acender antes da rolagem
        float inicio = smoothstep(0., .12, uForm);
        keep *= inicio; edge *= inicio;
        vec3 col = mix(PAPER, draw, keep);
        // a borda de tinta só onde há desenho (sobre o papel vazio, ficaria um risco solto)
        col = mix(col, INK, edge * clamp(ink * 1.6, 0., .35));
        col = mix(col, draw, smoothstep(.9, 1., uForm));   // no fim, o desenho inteiro, sem falhas
        gl_FragColor = vec4(col, 1.);
      }`);
    if (!ctx) return;
    const { gl, u } = ctx;

    // a partir daqui o palco é uma tela só: título por cima, desenho (ainda papel) por baixo
    palco.classList.add('has-gl');
    quadro.appendChild(canvas);
    const convite = document.createElement('span');
    convite.className = 'leitura-convite';
    convite.setAttribute('aria-hidden', 'true');
    convite.textContent = 'role para ver';
    palco.appendChild(convite);

    // o título vira letras soltas (o h1 guarda o nome inteiro como rótulo acessível)
    let letras = [];
    if (titulo) {
      titulo.setAttribute('aria-label', titulo.textContent.trim());
      titulo.innerHTML = Array.from(titulo.textContent.trim())
        .map(ch => ch === ' ' ? ' ' : `<span class="leitura-letra" aria-hidden="true">${ch}</span>`).join('');
      letras = Array.from(titulo.querySelectorAll('.leitura-letra'));
    }
    const resto = Array.from(cabeca.querySelectorAll('.back-link, .eyebrow, .leitura-autor')).concat(convite);

    // alvo: o quanto a rolagem já pediu (0 a 1); t: o que está na tela, que segue o alvo
    // com suavidade. Letras ~0–40%, desenho ~12–100% (as duas fases se sobrepõem)
    let ready = false, t = 0, alvo = 0, raf = 0, travaAte = 0;
    const PERCURSO = () => window.innerHeight * 1.1;   // quanto de rolagem leva a sequência inteira
    const PASSO_MAX = 120;                              // limite por evento de rolagem (px)
    const VEL_MAX = .022;   // a tela avança no máximo isso por quadro: rolar rápido não pula nada

    // cor do papel do desenho: média das bordas da imagem (onde quase sempre só há papel)
    function paperOf(im) {
      const c2 = document.createElement('canvas'); c2.width = c2.height = 24;
      const x = c2.getContext('2d'); x.drawImage(im, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data; const sum = [0, 0, 0]; let n = 0;
      for (let i = 0; i < 24 * 24; i++) {
        const px = i % 24, py = (i / 24) | 0;
        if (px > 1 && px < 22 && py > 1 && py < 22) continue;
        sum[0] += d[i * 4]; sum[1] += d[i * 4 + 1]; sum[2] += d[i * 4 + 2]; n++;
      }
      return sum.map(v => Math.max(.5, v / n / 255));
    }

    function upload() {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.uniform1f(u('uImgAsp'), img.naturalWidth / img.naturalHeight);
      gl.uniform3fv(u('uWhite'), paperOf(img));
      ready = true;
      // chegou já rolado (voltar no histórico, link com âncora): o desenho já está inteiro
      if (window.scrollY > 2) t = alvo = 1;
      render();
    }

    const clamp01 = v => Math.min(1, Math.max(0, v));
    const suave = v => v * v * (3 - 2 * v);

    function render() {
      // título: cada letra se desfaz um pouco depois da anterior, subindo e desfocando
      const tt = clamp01(t / .4), n = letras.length, centro = (n - 1) / 2;
      letras.forEach((l, i) => {
        const k = suave(clamp01((tt - (i / Math.max(1, n)) * .45) / .55));
        l.style.opacity = (1 - k).toFixed(3);
        l.style.filter = k > .001 ? `blur(${(k * 7).toFixed(2)}px)` : '';
        l.style.transform = k > .001
          ? `translate(${((i - centro) * .05 * k).toFixed(3)}em, ${(-k * .35).toFixed(3)}em)` : '';
      });
      resto.forEach(el => { el.style.opacity = (1 - suave(clamp01(tt * 1.6))).toFixed(3); });
      cabeca.style.pointerEvents = t > .2 ? 'none' : '';
      if (!ready) return;
      fit(canvas, 1);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
      gl.uniform1f(u('uForm'), clamp01((t - .12) / .88));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // a tela segue o alvo com suavidade (sem isso, cada clique da roda seria um degrau)
    function seguir() {
      raf = 0;
      t += Math.max(-VEL_MAX, Math.min(VEL_MAX, (alvo - t) * .14));
      if (Math.abs(alvo - t) < .0015) t = alvo;
      render();
      if (t !== alvo) raf = requestAnimationFrame(seguir);
    }

    // o gesto de rolar no topo da página: para baixo forma o desenho, para cima o desfaz
    function gesto(px, e) {
      if (!ready || window.scrollY > 2 || !px) return;
      const fim = alvo >= 1 && t >= .995;
      // desenho inteiro e rolando para baixo: a página desce (depois de absorver a inércia)
      if (px > 0 && fim && performance.now() >= travaAte) return;
      // título inteiro e rolando para cima: nada a desfazer
      if (px < 0 && alvo <= 0) return;
      e.preventDefault();
      if (px > 0 && fim) return;   // ainda absorvendo a inércia do gesto que terminou o desenho
      const antes = alvo;
      alvo = clamp01(alvo + Math.max(-PASSO_MAX, Math.min(PASSO_MAX, px)) / PERCURSO());
      if (antes < 1 && alvo >= 1) travaAte = performance.now() + 500;
      if (!raf) raf = requestAnimationFrame(seguir);
    }
    // a roda em modo "linha" (Firefox) vem em linhas, não em pixels
    window.addEventListener('wheel', (e) => gesto(e.deltaY * (e.deltaMode === 1 ? 16 : 1), e), { passive: false });
    let toqueY = null;
    window.addEventListener('touchstart', (e) => { toqueY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (toqueY === null) return;
      const y = e.touches[0].clientY;
      gesto((toqueY - y) * 1.4, e);
      toqueY = y;
    }, { passive: false });
    window.addEventListener('touchend', () => { toqueY = null; }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const baixo = ['ArrowDown', 'PageDown', 'End', ' '], cima = ['ArrowUp', 'PageUp', 'Home'];
      if (baixo.includes(e.key)) gesto(PASSO_MAX, e); else if (cima.includes(e.key)) gesto(-PASSO_MAX, e);
    });
    // se a página desceu por outro caminho (barra de rolagem, âncora), o desenho fica inteiro
    window.addEventListener('scroll', () => { if (window.scrollY > 2 && alvo < 1) { t = alvo = 1; render(); } }, { passive: true });
    window.addEventListener('resize', render);

    // sem once: ao cruzar 700px o <picture> troca entre o desenho largo e o vertical
    img.addEventListener('load', upload);
    if (img.complete && img.naturalWidth) upload();
    render();
  })();

  /* ---------- 3. mosaico: cada obra se revela em tinta ----------
     O mesmo grão de carvão do hero, ao contrário: uma folha de papel cobre cada
     obra e se desfaz quando ela entra na tela. Um único canvas fixo por cima do
     mosaico desenha todas as folhas; fora das obras ele é transparente, então
     cliques e hover passam direto. Quando todas se revelaram, o canvas sai. */
  (function mosaico() {
    const grids = Array.from(document.querySelectorAll('.mosaico'));
    if (!grids.length) return;
    const items = grids.flatMap(g => Array.from(g.querySelectorAll('.mosaico-item')));
    const MAX = 32;
    if (!items.length || items.length > MAX) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'mosaico-gl';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    const frag = `precision highp float;
      uniform vec4 uR[${MAX}]; uniform float uPr[${MAX}]; uniform float uN, uDpr, uVh;
      ${PAPER} ${NOISE}
      void main(){
        vec2 px = vec2(gl_FragCoord.x, uVh*uDpr - gl_FragCoord.y) / uDpr;   // em px de CSS, y para baixo
        for (int i = 0; i < ${MAX}; i++) {
          if (float(i) >= uN) break;
          vec4 r = uR[i];
          if (px.x >= r.x && px.y >= r.y && px.x < r.x + r.z && px.y < r.y + r.w) {
            float n = fbm((px - r.xy)/90. + float(i)*3.1)*.78 + hash(floor(gl_FragCoord.xy/1.5))*.22;
            float th = mix(1.05, -.12, uPr[i]);
            float shown = smoothstep(th, th + .06, n);
            float edge = smoothstep(th - .015, th + .015, n) * (1. - smoothstep(th + .015, th + .07, n));
            vec3 paper = PAPER + (hash(gl_FragCoord.xy) - .5)*.03;
            float a = max(1. - shown, edge*.55);
            vec3 col = mix(paper, INK, edge*.55 / max(a, .001));
            gl_FragColor = vec4(col*a, a);
            return;
          }
        }
        gl_FragColor = vec4(0.);
      }`;
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (console.warn(gl.getShaderInfoLog(s)), null); };
    const vs = compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }');
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'uR'), uPr = gl.getUniformLocation(prog, 'uPr');
    const uN = gl.getUniformLocation(prog, 'uN'), uDpr = gl.getUniformLocation(prog, 'uDpr'), uVh = gl.getUniformLocation(prog, 'uVh');

    document.body.appendChild(canvas);
    grids.forEach(g => g.classList.add('has-gl'));   // desliga a revelação em CSS: quem revela agora é a tinta

    const shown = new Float32Array(MAX);   // progresso de cada obra; só cresce (não se cobre de novo)
    const rects = new Float32Array(MAX * 4);
    let raf = 0, visible = false, done = false;

    function frame() {
      raf = 0;
      if (done || !visible) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const w = Math.round(vw * dpr), h = Math.round(vh * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      let pending = 0;
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        rects.set([r.left, r.top, r.width, r.height], i * 4);
        // a obra se forma enquanto sobe pelos 55% de baixo da tela
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * .55)));
        if (p > shown[i]) shown[i] = Math.min(1, shown[i] + Math.min(.06, p - shown[i]));   // tinta tem seu tempo
        if (shown[i] < 1) pending++;
      });
      gl.viewport(0, 0, w, h);
      gl.uniform4fv(uR, rects); gl.uniform1fv(uPr, shown);
      gl.uniform1f(uN, items.length); gl.uniform1f(uDpr, dpr); gl.uniform1f(uVh, vh);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!pending) { done = true; canvas.remove(); return; }   // tudo revelado: o canvas sai de cena
      // continua enquanto alguma obra visível ainda está se formando
      if (items.some((el, i) => shown[i] < 1 && el.getBoundingClientRect().top < vh)) request();
    }
    function request() { if (!raf && !done) raf = requestAnimationFrame(frame); }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    // visível enquanto qualquer um dos mosaicos (um por coleção) estiver na tela
    const naTela = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => (e.isIntersecting ? naTela.add(e.target) : naTela.delete(e.target)));
      visible = naTela.size > 0;
      canvas.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) request();
    }, { rootMargin: '0px 0px 10% 0px' });
    grids.forEach(g => io.observe(g));
  })();
})();
