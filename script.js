// AUGUSTO TOMBA — wireframe v1
document.addEventListener('DOMContentLoaded', () => {

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
  const revealEls = document.querySelectorAll('.ma, .reveal, .reveal-left, .reveal-right, .stagger');

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

  /* ---------- parallax do hero ----------
     invertido em relação à rolagem: a imagem desce um pouco enquanto a
     página sobe, então ela assenta rápido perto do limite e fica quase
     parada em relação aos olhos — mais sensação de profundidade.*/
     
  const parallaxEl = document.querySelector('[data-parallax]');
  if (parallaxEl && !reduceMotion) {
    const band = parallaxEl.parentElement;
    let ticking = false;

    function updateParallax() {
      const rect = band.getBoundingClientRect();
      const maxShift = rect.height * 1; // limite seguro = folga real da imagem (14% / 2)
      let offset = -rect.top * 0.75; // invertido e bem mais forte que antes
      offset = Math.max(-maxShift, Math.min(maxShift, offset));
      parallaxEl.style.transform = `translateY(${offset}px)`;
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

});