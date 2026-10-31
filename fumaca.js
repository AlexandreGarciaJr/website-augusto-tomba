// AUGUSTO TOMBA — fumaça de sumi, ao fundo do manifesto
// Simulação de fluido (Navier-Stokes simplificado, "stable fluids") em WebGL puro: tinta
// diluída sobe e se espalha devagar sobre o papel. O cursor não deforma a imagem, ele sopra:
// a fumaça se dispersa em volta dele, gira e volta a preencher o espaço.
// Simulação em baixa resolução, pausa fora da tela e com a aba oculta, reduz a resolução se
// a GPU não acompanhar e não roda em GPU por software (o papel fica liso).
// Movimento reduzido: simula alguns passos, desenha um quadro e para.
// Teste em ambiente sem GPU: ?fumaca=forcar
(function () {
  const sec = document.querySelector('.manifesto');
  if (!sec) return;

  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toque = window.matchMedia('(pointer: coarse)').matches;
  const forcar = /[?&]fumaca=forcar/.test(location.search);

  const CFG = {
    SIM: toque ? 96 : 128,      // resolução da velocidade/pressão
    DYE: toque ? 320 : 512,     // resolução da fumaça
    DISSIP_DENS: 0.1,           // quanto a fumaça some por segundo
    DISSIP_VEL: 0.6,
    PRESSAO: 0.8,
    ITER: toque ? 14 : 20,
    CURL: 10,                   // quanto a fumaça "enrola"
    RAIO_CURSOR: 0.012,         // área de dispersão do cursor
    FORCA_CURSOR: 2400,         // o sopro acompanha o movimento (leve)
    RAJADA: 26,                 // empurrão radial (dispersão)
    EMPUXO: 10,                 // quanto a fumaça sobe sozinha
    SUBIDA: 14,
    TURBULENCIA: 20,            // correntes lentas que espalham a fumaça pela tela
    TEMPO: 0.45,                // velocidade geral (1 = tempo real; menor = mais lento)
    TINTA_MIN: 0.17,            // densidade da tinta no começo e no fim da seção
    TINTA_MAX: 0.24
  };

  function iniciar() {
    const canvas = document.createElement('canvas');
    canvas.className = 'manifesto-gl';
    const opcoes = { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'low-power' };
    let gl = canvas.getContext('webgl2', opcoes);
    const gl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', opcoes);
    if (!gl) return;

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    // ao desistir, devolve o contexto na hora (o navegador tem um limite de contextos WebGL)
    const perder = () => { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); };
    if (!forcar && /swiftshader|llvmpipe|software|softpipe|basic render/i.test(gpu)) { perder(); return; }

    // textura em ponto flutuante (half float)
    let fmt;
    if (gl2) {
      if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) { perder(); return; }
      fmt = { interno: gl.RGBA16F, formato: gl.RGBA, tipo: gl.HALF_FLOAT };
    } else {
      const hf = gl.getExtension('OES_texture_half_float');
      if (!hf || !gl.getExtension('OES_texture_half_float_linear')) { perder(); return; }
      fmt = { interno: gl.RGBA, formato: gl.RGBA, tipo: hf.HALF_FLOAT_OES };
    }

    /* ---------- shaders ---------- */
    const VS = `precision highp float;attribute vec2 p;uniform vec2 tx;
      varying vec2 vUv,vL,vR,vT,vB;
      void main(){vUv=p*.5+.5;vL=vUv-vec2(tx.x,0.);vR=vUv+vec2(tx.x,0.);vT=vUv+vec2(0.,tx.y);vB=vUv-vec2(0.,tx.y);gl_Position=vec4(p,0.,1.);}`;
    const H = 'precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;';
    const FS = {
      // rajada: soma velocidade (direção do cursor + empurrão radial) ou densidade
      splat: H + `uniform sampler2D uAlvo;uniform float asp;uniform vec3 cor;uniform vec2 pt;uniform float raio;uniform float radial;
        void main(){vec2 d=vUv-pt;d.x*=asp;float g=exp(-dot(d,d)/raio);vec3 base=texture2D(uAlvo,vUv).xyz;
        vec2 dir=length(d)>1e-5?normalize(d):vec2(0.);
        gl_FragColor=vec4(base+(cor+vec3(dir*radial,0.))*g,1.);}`,
      advec: H + `uniform sampler2D uVel;uniform sampler2D uFonte;uniform vec2 tx;uniform float dt;uniform float dissip;
        void main(){vec2 c=vUv-dt*texture2D(uVel,vUv).xy*tx;gl_FragColor=texture2D(uFonte,c)/(1.+dissip*dt);}`,
      curl: H + `uniform sampler2D uVel;void main(){float L=texture2D(uVel,vL).y,R=texture2D(uVel,vR).y,T=texture2D(uVel,vT).x,B=texture2D(uVel,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`,
      vort: H + `uniform sampler2D uVel;uniform sampler2D uCurl;uniform float curl;uniform float dt;
        void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;
        vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+1e-4;f*=curl*C;f.y*=-1.;
        vec2 v=texture2D(uVel,vUv).xy+f*dt;gl_FragColor=vec4(clamp(v,-1000.,1000.),0.,1.);}`,
      div: H + `uniform sampler2D uVel;void main(){float L=texture2D(uVel,vL).x,R=texture2D(uVel,vR).x,T=texture2D(uVel,vT).y,B=texture2D(uVel,vB).y;vec2 C=texture2D(uVel,vUv).xy;
        if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`,
      // empuxo + turbulência lenta (campo de ruído com rotacional): a fumaça sobe e se espalha devagar
      flutua: H + `uniform sampler2D uVel;uniform sampler2D uDye;uniform float b;uniform float dt;uniform float tt;uniform float turb;
        float hh(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5453);}
        float nn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+1.),f.x),f.y);}
        float campo(vec2 p){return nn(p)+.5*nn(p*2.1+7.3);}
        void main(){vec2 v=texture2D(uVel,vUv).xy;float d=texture2D(uDye,vUv).r;
        vec2 p=vUv*vec2(3.,2.)+vec2(tt*.03,-tt*.02);float e=.02;
        vec2 c=vec2(campo(p+vec2(0.,e))-campo(p-vec2(0.,e)),-(campo(p+vec2(e,0.))-campo(p-vec2(e,0.))))/(2.*e);
        v+=c*turb*dt;v.y+=min(d,1.5)*b*dt;gl_FragColor=vec4(v,0.,1.);}`,
      limpa: H + 'uniform sampler2D uP;uniform float v;void main(){gl_FragColor=v*texture2D(uP,vUv);}',
      pressao: H + 'uniform sampler2D uP;uniform sampler2D uDiv;void main(){float L=texture2D(uP,vL).x,R=texture2D(uP,vR).x,T=texture2D(uP,vT).x,B=texture2D(uP,vB).x,d=texture2D(uDiv,vUv).x;gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.);}',
      grad: H + 'uniform sampler2D uP;uniform sampler2D uVel;void main(){float L=texture2D(uP,vL).x,R=texture2D(uP,vR).x,T=texture2D(uP,vT).x,B=texture2D(uP,vB).x;vec2 v=texture2D(uVel,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}',
      // tinta (a cor do texto) sobre o papel da página: só muda a transparência
      tela: H + `uniform sampler2D uDye;uniform float t;uniform float asp;uniform float tinta;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
        float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.07+vec2(3.1,1.7);a*=.5;}return s;}
        void main(){float d=texture2D(uDye,vUv).r;
        float w=fbm(vec2(vUv.x*asp,vUv.y)*3.2+vec2(0.,-t*.012));d*=mix(.45,1.45,w);   // fiapos: nunca uma mancha lisa
        float a=(1.-exp(-pow(max(d,0.),1.7)*1.5))*tinta;
        a*=smoothstep(0.,.14,vUv.y)*smoothstep(1.,.86,vUv.y);                          // some nas bordas, sem corte
        gl_FragColor=vec4(vec3(.169,.157,.145)*a,a);}`
    };

    const compilar = (tipo, src) => {
      const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const P = {};
    try {
      const vs = compilar(gl.VERTEX_SHADER, VS);
      for (const k in FS) {
        const p = gl.createProgram();
        gl.attachShader(p, vs); gl.attachShader(p, compilar(gl.FRAGMENT_SHADER, FS[k]));
        gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
        P[k] = { p, u };
      }
    } catch (e) { console.warn(e); perder(); return; }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // só agora o canvas entra na página: sem suporte, o papel fica como está
    const fundo = document.createElement('div');
    fundo.className = 'manifesto-fundo';
    fundo.setAttribute('aria-hidden', 'true');
    fundo.appendChild(canvas);
    sec.prepend(fundo);

    /* ---------- alvos de renderização ---------- */
    function alvo(w, h) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt.interno, w, h, 0, fmt.formato, fmt.tipo, null);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return { t, f, w, h, tx: [1 / w, 1 / h] };
    }
    const duplo = (w, h) => ({ ler: alvo(w, h), esc: alvo(w, h), troca() { const x = this.ler; this.ler = this.esc; this.esc = x; } });
    const liberar = (o) => { if (!o) return; [o.ler || o, o.esc].forEach(a => { if (a) { gl.deleteTexture(a.t); gl.deleteFramebuffer(a.f); } }); };

    let W = 2, Ht = 2, vel, dye, divg, curlT, pres, asp = 1, cw = 0, ch = 0;
    let escala = toque ? 0.5 : 0.75;
    function tam(base) {
      return asp > 1 ? { w: Math.round(base * asp), h: base } : { w: base, h: Math.round(base / asp) };
    }
    function ajustarCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = Math.max(2, Math.round(cw * dpr * escala));
      Ht = Math.max(2, Math.round(ch * dpr * escala));
      canvas.width = W; canvas.height = Ht;
    }
    function medir() {
      cw = canvas.clientWidth || window.innerWidth;
      ch = canvas.clientHeight || window.innerHeight;
      asp = cw / ch;
      ajustarCanvas();
      const s = tam(CFG.SIM), d = tam(CFG.DYE);
      [vel, dye, pres, divg, curlT].forEach(liberar);
      vel = duplo(s.w, s.h); dye = duplo(d.w, d.h); pres = duplo(s.w, s.h);
      divg = alvo(s.w, s.h); curlT = alvo(s.w, s.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    medir();
    // confirma que dá para renderizar em half float (alguns celulares mentem)
    gl.bindFramebuffer(gl.FRAMEBUFFER, vel.ler.f);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { fundo.remove(); perder(); return; }

    function usar(pr, destino, tx) {
      gl.useProgram(pr.p);
      if (tx && pr.u.tx) gl.uniform2f(pr.u.tx, tx[0], tx[1]);
      if (destino) { gl.bindFramebuffer(gl.FRAMEBUFFER, destino.f); gl.viewport(0, 0, destino.w, destino.h); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Ht); }
    }
    const tex = (unidade, t) => { gl.activeTexture(gl.TEXTURE0 + unidade); gl.bindTexture(gl.TEXTURE_2D, t); return unidade; };
    const desenhar = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    function splat(d, x, y, cor, raio, radial) {
      usar(P.splat, d.esc, d.ler.tx);
      gl.uniform1i(P.splat.u.uAlvo, tex(0, d.ler.t));
      gl.uniform1f(P.splat.u.asp, asp);
      gl.uniform2f(P.splat.u.pt, x, y);
      gl.uniform3f(P.splat.u.cor, cor[0], cor[1], cor[2]);
      gl.uniform1f(P.splat.u.raio, raio);
      gl.uniform1f(P.splat.u.radial, radial || 0);
      desenhar(); d.troca();
    }

    let relogioSim = 0;
    function passo(dt) {
      const tx = vel.ler.tx;
      usar(P.flutua, vel.esc, tx); gl.uniform1i(P.flutua.u.uVel, tex(0, vel.ler.t)); gl.uniform1i(P.flutua.u.uDye, tex(1, dye.ler.t));
      gl.uniform1f(P.flutua.u.b, CFG.EMPUXO); gl.uniform1f(P.flutua.u.dt, dt); gl.uniform1f(P.flutua.u.tt, relogioSim); gl.uniform1f(P.flutua.u.turb, CFG.TURBULENCIA); desenhar(); vel.troca();
      relogioSim += dt;
      usar(P.curl, curlT, tx); gl.uniform1i(P.curl.u.uVel, tex(0, vel.ler.t)); desenhar();
      usar(P.vort, vel.esc, tx); gl.uniform1i(P.vort.u.uVel, tex(0, vel.ler.t)); gl.uniform1i(P.vort.u.uCurl, tex(1, curlT.t));
      gl.uniform1f(P.vort.u.curl, CFG.CURL); gl.uniform1f(P.vort.u.dt, dt); desenhar(); vel.troca();
      usar(P.div, divg, tx); gl.uniform1i(P.div.u.uVel, tex(0, vel.ler.t)); desenhar();
      usar(P.limpa, pres.esc, tx); gl.uniform1i(P.limpa.u.uP, tex(0, pres.ler.t)); gl.uniform1f(P.limpa.u.v, CFG.PRESSAO); desenhar(); pres.troca();
      usar(P.pressao, null, tx); gl.uniform1i(P.pressao.u.uDiv, tex(1, divg.t));
      for (let i = 0; i < CFG.ITER; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pres.esc.f); gl.viewport(0, 0, pres.esc.w, pres.esc.h);
        gl.uniform1i(P.pressao.u.uP, tex(0, pres.ler.t)); desenhar(); pres.troca();
      }
      usar(P.grad, vel.esc, tx); gl.uniform1i(P.grad.u.uP, tex(0, pres.ler.t)); gl.uniform1i(P.grad.u.uVel, tex(1, vel.ler.t)); desenhar(); vel.troca();
      // advecção da velocidade e da fumaça
      usar(P.advec, vel.esc, tx);
      gl.uniform1i(P.advec.u.uVel, tex(0, vel.ler.t)); gl.uniform1i(P.advec.u.uFonte, tex(0, vel.ler.t));
      gl.uniform1f(P.advec.u.dt, dt); gl.uniform1f(P.advec.u.dissip, CFG.DISSIP_VEL); desenhar(); vel.troca();
      usar(P.advec, dye.esc, tx);
      gl.uniform1i(P.advec.u.uVel, tex(0, vel.ler.t)); gl.uniform1i(P.advec.u.uFonte, tex(1, dye.ler.t));
      gl.uniform1f(P.advec.u.dt, dt); gl.uniform1f(P.advec.u.dissip, CFG.DISSIP_DENS); desenhar(); dye.troca();
    }

    /* ---------- fontes: plumas que sobem de baixo e entram pelos lados ---------- */
    const FONTES = [
      { x: 0.14, y: 0.03, f: 0.8, fase: 0 },
      { x: 0.48, y: 0.02, f: 0.55, fase: 2.1 },
      { x: 0.84, y: 0.03, f: 0.9, fase: 3.4 },
      { x: 0.01, y: 0.55, f: 0.3, fase: 4.2, lado: 1 },
      { x: 0.99, y: 0.45, f: 0.35, fase: 5.3, lado: -1 }
    ];
    function alimentar(t, dt) {
      for (const F of FONTES) {
        const x = F.x + Math.sin(t * 0.23 + F.fase) * 0.05, y = F.y + (F.lado ? Math.sin(t * 0.19 + F.fase) * 0.2 : 0);
        const vx = F.lado ? F.lado * CFG.SUBIDA * 1.1 : Math.sin(t * 0.5 + F.fase) * CFG.SUBIDA * 0.35, vy = F.lado ? CFG.SUBIDA * 0.25 : CFG.SUBIDA;
        splat(vel, x, y, [vx * F.f * dt * 4, vy * F.f * dt * 4, 0], 0.006, 0);
        splat(dye, x, y, [1.5 * F.f * dt, 0, 0], 0.008, 0);
      }
    }

    /* ---------- ponteiro: o sopro que dispersa ---------- */
    const PT = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, mov: false, ultimo: 0, rajada: 0 };
    function aoMover(e) {
      const r = canvas.getBoundingClientRect();
      PT.x = (e.clientX - r.left) / r.width;
      PT.y = 1 - (e.clientY - r.top) / r.height;
      // voltando de fora da seção: começa onde o cursor está, sem soprar a tela inteira
      if (!PT.mov || performance.now() - PT.ultimo > 400) { PT.px = PT.x; PT.py = PT.y; }
      PT.mov = true;
      PT.ultimo = performance.now();
    }
    if (!reduzido) {
      sec.addEventListener('pointermove', aoMover, { passive: true });
      sec.addEventListener('pointerdown', (e) => { aoMover(e); PT.rajada = 1; }, { passive: true });
    }

    /* ---------- laço ---------- */
    let rodando = false, visivel = false, raf = 0, antes = 0, t0 = performance.now();
    let amostras = [], degraus = 0, ultimoQ = 0;
    function orcamento(agora) {
      if (ultimoQ) amostras.push(agora - ultimoQ);
      ultimoQ = agora;
      if (amostras.length < 40) return true;
      amostras.sort((a, b) => a - b);
      const mediana = amostras[20]; amostras = [];
      if (mediana > 26) {
        degraus++;
        if (degraus > 2) { rodando = false; return false; }
        CFG.ITER = Math.max(8, CFG.ITER - 6); escala *= 0.75;
        ajustarCanvas();
      }
      return true;
    }

    function simular(agora) {
      const t = (agora - t0) / 1000;
      const dt = Math.min(0.033, Math.max(0.008, (agora - (antes || agora - 16)) / 1000)) * CFG.TEMPO;
      antes = agora;
      alimentar(t * CFG.TEMPO * 2, dt);
      // cursor fantasma quando ninguém mexe: a fumaça continua viva
      const ocioso = !PT.mov || agora - PT.ultimo > 2800;
      if (ocioso) {
        PT.x = 0.5 + 0.34 * Math.sin(t * 0.14) * Math.cos(t * 0.05);
        PT.y = 0.5 + 0.28 * Math.sin(t * 0.1 + 1.3);
      }
      const dx = PT.x - PT.px, dy = PT.y - PT.py, v = Math.hypot(dx * asp, dy);
      if (v > 0.0004 || PT.rajada) {
        const k = ocioso ? 0.3 : 1;
        const rad = (Math.min(1, v * 40) * CFG.RAJADA + (PT.rajada ? CFG.RAJADA * 1.6 : 0)) * k;
        splat(vel, PT.x, PT.y, [dx * CFG.FORCA_CURSOR * k, dy * CFG.FORCA_CURSOR * k, 0], CFG.RAIO_CURSOR * (PT.rajada ? 2 : 1), rad);
        PT.rajada = 0;
      }
      PT.px = PT.x; PT.py = PT.y;
      passo(dt);
      return t;
    }

    function pintar(t) {
      const r = sec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      usar(P.tela, null, dye.ler.tx);
      gl.uniform1i(P.tela.u.uDye, tex(0, dye.ler.t));
      gl.uniform1f(P.tela.u.t, t);
      gl.uniform1f(P.tela.u.asp, asp);
      gl.uniform1f(P.tela.u.tinta, CFG.TINTA_MIN + (CFG.TINTA_MAX - CFG.TINTA_MIN) * p);
      desenhar();
    }

    function quadro(agora) {
      raf = 0;
      if (!forcar && !orcamento(agora)) return;
      pintar(simular(agora));
      if (rodando) raf = requestAnimationFrame(quadro);
    }
    function atualizarLoop() {
      const deve = visivel && !document.hidden && !reduzido;
      if (deve && !rodando) { rodando = true; ultimoQ = 0; amostras = []; antes = 0; raf = requestAnimationFrame(quadro); }
      else if (!deve && rodando) { rodando = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }
    new IntersectionObserver(([entry]) => { visivel = entry.isIntersecting; atualizarLoop(); }, { rootMargin: '30% 0px 30% 0px' }).observe(sec);
    document.addEventListener('visibilitychange', atualizarLoop);

    // já começa com fumaça no quadro (sem "tela vazia" enchendo)
    function preencher(n) {
      for (let i = 0; i < 26; i++) {
        const x = Math.random(), y = 0.05 + Math.random() * 0.9;
        splat(dye, x, y, [0.45 + Math.random() * 0.45, 0, 0], 0.003 + Math.random() * 0.008, 0);
        splat(vel, x, y, [(Math.random() - 0.5) * 30, 6 + Math.random() * 14, 0], 0.01, 0);
      }
      for (let j = 0; j < n; j++) { alimentar(20 + j * 0.03, 0.016); passo(0.016); }
      t0 = performance.now() - 20000;
    }

    // só recria a simulação se o tamanho do canvas mudou mesmo (no celular, a barra do
    // navegador dispara resize sem mudar o 100vh, e isso apagaria a fumaça)
    let tRes;
    window.addEventListener('resize', () => {
      clearTimeout(tRes);
      tRes = setTimeout(() => {
        if (canvas.clientWidth === cw && canvas.clientHeight === ch) return;
        medir(); preencher(24); if (!rodando) pintar((performance.now() - t0) / 1000);
      }, 180);
    });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); rodando = false; fundo.remove(); });

    preencher(reduzido ? 110 : 70);
    if (reduzido) pintar(20);
    else atualizarLoop();
  }

  // começa depois do load, sem disputar com a abertura da página
  const quandoOcioso = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(iniciar, { timeout: 1200 });
    else setTimeout(iniciar, 200);
  };
  if (document.readyState === 'complete') quandoOcioso();
  else window.addEventListener('load', quandoOcioso, { once: true });
})();
