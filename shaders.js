// AUGUSTO TOMBA — shaders (WebGL puro, sem bibliotecas)
// 1. Hero: a imagem se dissolve em grão de carvão conforme a rolagem e,
//    sob o cursor (ou o dedo), ondula como tinta em papel molhado.
// 2. Declaração pausada: fumaça de sumi, tinta diluída se movendo atrás da frase.
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
      if (hero && hero.querySelector('.hero-pin')) hero.classList.add('is-pinned');
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

  /* ---------- 2. declaração: fumaça de sumi ---------- */
  (function smoke() {
    const pausa = document.querySelector('.declaracao-pausa');
    const quadro = pausa && pausa.querySelector('.declaracao-pausa-quadro');
    if (!quadro) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'pausa-gl';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = createGL(canvas, `precision mediump float; varying vec2 vUv;
      uniform vec2 uRes; uniform float uT, uP;
      ${PAPER} ${NOISE}
      void main(){
        vec2 asp = vec2(uRes.x/uRes.y, 1.);
        vec2 p = vUv*asp*1.6;
        float w = fbm(p + vec2(uT*.03, -uT*.05));
        float f = fbm(p*1.3 + w*2.2 + vec2(-uT*.02, uT*.04));
        float a = smoothstep(.45, .85, f) * (.06 + .09*uP);
        a *= smoothstep(0., .22, vUv.y) * smoothstep(1., .78, vUv.y);   // some nas bordas, sem corte
        float g = (hash(floor(gl_FragCoord.xy)) - .5) * .015;
        gl_FragColor = vec4(mix(PAPER, INK, a) + g, 1.);
      }`);
    if (!ctx) return;
    const { gl, u } = ctx;
    quadro.prepend(canvas);
    quadro.classList.add('has-gl');

    let visible = false, raf = 0;
    const t0 = performance.now();

    // o canvas ocupa a largura da janela (sem a barra de rolagem), não só a coluna de texto
    function place() {
      const vw = document.documentElement.clientWidth;
      const left = quadro.getBoundingClientRect().left;
      canvas.style.width = vw + 'px';
      canvas.style.left = -left + 'px';
    }
    function frame(now) {
      raf = 0;
      if (!visible) return;
      fit(canvas, .5);   // fumaça é macia: meia resolução basta
      const r = pausa.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('uRes'), canvas.width, canvas.height);
      gl.uniform1f(u('uT'), (now - t0) / 1000);
      gl.uniform1f(u('uP'), p);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }
    window.addEventListener('resize', place);
    place();
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(pausa);
  })();
})();
