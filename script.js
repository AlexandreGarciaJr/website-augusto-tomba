// AUGUSTO TOMBA — wireframe v1
document.addEventListener('DOMContentLoaded', () => {

  /* links marcados aria-disabled não devem ser ativáveis nem por mouse nem por teclado */
  document.querySelectorAll('a[aria-disabled="true"]').forEach(link => {
    link.setAttribute('tabindex', '-1');
    link.addEventListener('click', (e) => e.preventDefault());
  });

  /* menu overlay */
  const trigger = document.querySelector('.menu-trigger');
  const overlay = document.querySelector('.menu-overlay');

  if (trigger && overlay) {
    const closeMenu = () => {
      trigger.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    };
    const openMenu = () => {
      trigger.setAttribute('aria-expanded', 'true');
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    };

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      isOpen ? closeMenu() : openMenu();
    });

    overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* revelação suave (linha "ma" + blocos) */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.ma, .reveal, .reveal-left, .reveal-right, .stagger, .ma2');

  if (reduceMotion) {
    revealEls.forEach(el => el.classList.add('is-visible'));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* entrada do hero ao carregar */
  requestAnimationFrame(() => {
    setTimeout(() => document.body.classList.add('is-loaded'), 80);
  });

  /* newsletter (protótipo — sem envio real) */
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Recebido';
        setTimeout(() => { btn.textContent = original; }, 1800);
      }
    });
  });

  /* ---------- parallax do hero, em camadas ----------
     Três camadas se movem em velocidades diferentes, criando profundidade
     real (não só um deslocamento): a imagem desliza e ganha um zoom sutil
     enquanto desfoca progressivamente — uma "dissolução" na neblina, eco
     direto da Declaração de Artista ("Antes do traço ou da palavra, a
     dissolução"). O texto (nome/tagline) se move numa velocidade própria,
     mais lenta que o fundo, separando visualmente os dois planos. */

  const parallaxEl = document.querySelector('[data-parallax]');
  const heroDissolveEl = document.querySelector('.hero-photo-dissolvida');
  const heroTextEl = document.querySelector('.hero-image-content');

  // depois que a imagem emergiu do papel, a máscara sai de cena (nada de custo extra por frame)
  if (parallaxEl) {
    parallaxEl.addEventListener('animationend', () => parallaxEl.classList.add('is-emerged'), { once: true });
  }

  if (parallaxEl && !reduceMotion) {
    const band = parallaxEl.parentElement;
    let ticking = false;

    function updateParallax() {
      const rect = band.getBoundingClientRect();
      const bandHeight = rect.height || 1;

      // quanto a faixa já subiu desde a posição de repouso (topo da página).
      // Medir pela rolagem, e não por rect.top, evita puxar a imagem para cima
      // por causa da altura do header — era isso que abria o vão em 1024px.
      const scrolled = Math.max(0, window.scrollY);

      // deslocamento vertical da imagem (desce enquanto a página sobe): quase parada
      // em relação ao olhar, nunca 100% fixa
      const maxShift = bandHeight * 1;
      const offset = Math.min(maxShift, scrolled * 0.6);

      // progresso de 0 (repouso) a 1 (faixa já rolou por completo)
      const progress = Math.min(1, scrolled / bandHeight);
      const scale = 1 + progress * 0.08;   // zoom sutil, até 8%
      const textOffset = scrolled * 0.22;  // texto em velocidade própria — separa os planos

      parallaxEl.style.transform = `translateY(${offset}px) scale(${scale})`;
      if (heroDissolveEl) {
        heroDissolveEl.style.opacity = progress.toFixed(3); // a "dissolução", só por opacidade
      }
      if (heroTextEl) {
        heroTextEl.style.transform = `translateY(${textOffset}px)`;
      }

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });

    window.addEventListener('resize', updateParallax);
    updateParallax();
  }

  /* ---------- header reativo ao scroll ----------
     encolhe e ganha fundo translúcido com blur após uma pequena rolagem;
     recolhe para fora da tela ao rolar para baixo, reaparece ao rolar
     para cima; a borda inferior funciona como indicador de progresso
     de leitura da página — reaproveita a linguagem do "ma" (linha fina)
     de um jeito que responde ao scroll. */
  (function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const SCROLL_THRESHOLD = 30;   // a partir daqui, header "encolhido"
    const HIDE_THRESHOLD = 140;    // só esconde depois de rolar um pouco
    let lastY = window.scrollY;
    let ticking = false;

    function updateHeader() {
      const y = window.scrollY;

      header.classList.toggle('is-scrolled', y > SCROLL_THRESHOLD);

      if (y > HIDE_THRESHOLD && y > lastY) {
        header.classList.add('is-hidden');   // rolando para baixo
      } else {
        header.classList.remove('is-hidden'); // rolando para cima ou perto do topo
      }

      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const progress = scrollable > 0 ? Math.min(100, (y / scrollable) * 100) : 0;
      header.style.setProperty('--scroll-progress', progress + '%');

      lastY = y;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });

    updateHeader();
  })();

  /* ============================================================
     MELHORIAS DE FUNCIONALIDADE — v2
     ============================================================ */

  /* ---------- transição suave entre páginas ---------- */
  const transitionEl = document.querySelector('.page-transition');
  // navegadores com View Transitions entre documentos cuidam da saída sozinhos (CSS @view-transition)
  const nativeTransitions = 'PageRevealEvent' in window;
  if (transitionEl && !nativeTransitions) {
    // voltando pelo histórico (bfcache), a página volta congelada com o overlay opaco: limpa
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) transitionEl.classList.remove('is-exiting');
    });

    const NAV_DURATION = 420;

    document.querySelectorAll('a[href]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href'); // lido no clique, não no load —
                                                  // importante para links dinâmicos (ex: lightbox)
        if (
          !href ||
          href.startsWith('#') ||
          href.startsWith('http') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          link.target === '_blank' ||
          link.hasAttribute('data-lightbox')
        ) return;
        // deixa cliques com modificador (nova aba, etc.) passarem direto
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        transitionEl.classList.add('is-exiting');
        setTimeout(() => { window.location.href = href; }, NAV_DURATION);
      });
    });
  }

  /* ---------- lightbox de obra (mosaico + grid de quadros) ---------- */
  (function initLightbox() {
    const lightbox = document.querySelector('.lightbox');
    const triggers = Array.from(document.querySelectorAll('[data-lightbox]'));
    if (!lightbox || !triggers.length) return;

    const imageLabel = lightbox.querySelector('.lightbox-image-label');
    const numEl = lightbox.querySelector('.lightbox-num');
    const titleEl = lightbox.querySelector('.lightbox-title');
    const metaEl = lightbox.querySelector('.lightbox-meta');
    const fullLink = lightbox.querySelector('.lightbox-full-link');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const nextBtn = lightbox.querySelector('.lightbox-next');
    let current = 0;
    let lastFocused = null;

    function dataOf(trigger) {
      const num = trigger.dataset.num || '';
      const title = trigger.dataset.title || '[ Título da obra ]';
      const meta = trigger.dataset.meta || '[ Técnica, ano ]';
      const href = trigger.dataset.href || trigger.getAttribute('href') || 'quadro.html';
      return { num, title, meta, href };
    }

    function renderAt(i) {
      current = (i + triggers.length) % triggers.length;
      const { num, title, meta, href } = dataOf(triggers[current]);
      if (imageLabel) imageLabel.textContent = num;
      if (numEl) numEl.textContent = num;
      if (titleEl) titleEl.textContent = title;
      if (metaEl) metaEl.textContent = meta;
      if (fullLink) fullLink.setAttribute('href', href);
    }

    const panel = lightbox.querySelector('.lightbox-panel');
    const imageEl = lightbox.querySelector('.lightbox-image');

    // a obra "abre" a partir do quadro clicado: a imagem do lightbox nasce
    // no retângulo do item do mosaico e cresce até o lugar dela (FLIP)
    function growFrom(trigger) {
      if (reduceMotion || !imageEl || !imageEl.animate) return;
      const from = trigger.getBoundingClientRect();
      const to = imageEl.getBoundingClientRect();
      if (!from.width || !to.width) return;
      const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      imageEl.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})` },
        { transform: 'none' }
      ], { duration: 620, easing: 'cubic-bezier(.22,.61,.36,1)' });
    }

    function open(i) {
      lastFocused = document.activeElement;
      renderAt(i);
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      growFrom(triggers[current]);
      const closeBtn = lightbox.querySelector('.lightbox-close');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    }

    function close() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
    }

    // focus trap: Tab e Shift+Tab circulam só dentro do painel enquanto ele está aberto
    function trapFocus(e) {
      const focusables = Array.from(panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'))
        .filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    }

    // swipe horizontal no toque: anterior / próxima
    let touchX = null, touchY = null;
    panel.addEventListener('touchstart', (e) => {
      touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
    }, { passive: true });
    panel.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      touchX = touchY = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) renderAt(current + (dx < 0 ? 1 : -1));
    }, { passive: true });

    triggers.forEach((trigger, i) => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        open(i);
      });
    });

    lightbox.querySelectorAll('[data-lightbox-close]').forEach(el => {
      el.addEventListener('click', close);
    });
    if (prevBtn) prevBtn.addEventListener('click', () => renderAt(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => renderAt(current + 1));

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('is-open')) return;
      if (e.key === 'Tab') trapFocus(e);
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') renderAt(current - 1);
      if (e.key === 'ArrowRight') renderAt(current + 1);
    });
  })();

  /* ---------- índice lateral do mosaico ---------- */
  (function initMosaicoIndex() {
    const indexNav = document.querySelector('.mosaico-index');
    const mosaico = document.querySelector('.mosaico');
    if (!indexNav || !mosaico) return;

    const items = Array.from(mosaico.querySelectorAll('.mosaico-item'));
    const links = Array.from(indexNav.querySelectorAll('a'));
    if (!items.length || !links.length) return;

    // clique: rola suavemente até o item e dá um flash breve nele
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').replace('#', '');
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        target.classList.add('is-flashed');
        setTimeout(() => target.classList.remove('is-flashed'), 900);
      });
    });

    // visibilidade do índice: só aparece com o mosaico em tela
    if ('IntersectionObserver' in window) {
      const visibilityIO = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          indexNav.classList.toggle('is-active', entry.isIntersecting);
        });
      }, { threshold: 0.05 });
      visibilityIO.observe(mosaico);

      // item ativo: marca no índice qual obra está mais visível
      const activeIO = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach(l => l.classList.toggle('is-current', l.getAttribute('href') === `#${id}`));
        });
      }, { threshold: 0.5, rootMargin: '-40% 0px -40% 0px' });
      items.forEach(item => activeIO.observe(item));
    } else {
      indexNav.classList.add('is-active');
    }
  })();

});