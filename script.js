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
  const heroPhotoEl = document.querySelector('.hero-photo');
  const heroTextEl = document.querySelector('.hero-image-content');

  if (parallaxEl && !reduceMotion) {
    const band = parallaxEl.parentElement;
    let ticking = false;

    function updateParallax() {
      const rect = band.getBoundingClientRect();
      const bandHeight = rect.height || 1;

      // deslocamento vertical da imagem (invertido: desce enquanto a página sobe)
      const maxShift = bandHeight * 1;
      let offset = -rect.top * 0.6;
      offset = Math.max(-maxShift, Math.min(maxShift, offset));

      // progresso de 0 (topo da faixa no topo da tela) a 1 (faixa já rolou por completo)
      const progress = Math.min(1, Math.max(0, -rect.top / bandHeight));
      const scale = 1 + progress * 0.08;   // zoom sutil, até 8%
      const blur = progress * 3;            // desfoque progressivo, até 3px — a "dissolução"
      const textOffset = -rect.top * 0.22;  // texto em velocidade própria — separa os planos

      parallaxEl.style.transform = `translateY(${offset}px) scale(${scale})`;
      if (heroPhotoEl) {
        heroPhotoEl.style.filter = `contrast(.78) brightness(1.06) blur(${blur}px) url(#duotone)`;
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
  if (transitionEl) {
    // revela a página atual (o overlay começa opaco e desaparece)
    requestAnimationFrame(() => {
      setTimeout(() => transitionEl.classList.add('is-hidden'), 20);
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
        transitionEl.classList.remove('is-hidden');
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

    function open(i) {
      lastFocused = document.activeElement;
      renderAt(i);
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const closeBtn = lightbox.querySelector('.lightbox-close');
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

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