/* Scroll + motion layer: Lenis smooth scroll driven by the GSAP ticker, ScrollTrigger for
   the 3D story progress, the pinned product gallery, heading reveals, count-ups,
   magnetic buttons and pointer spotlights. Everything degrades to static under
   prefers-reduced-motion. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const faDigits = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

/* Wrap each word of a heading in a mask so it can rise into view. Text nodes are split on
   whitespace (Persian words and half-spaces stay intact); inline elements such as the
   gradient word are wrapped whole so background-clip text keeps working. */
function splitWords(el) {
  if (el.dataset.split) return [...el.querySelectorAll('.slp-w > span')];
  el.dataset.split = '1';
  const wrap = node => { const o = document.createElement('span'); o.className = 'slp-w'; const i = document.createElement('span'); o.appendChild(i); i.appendChild(node); return o; };
  [...el.childNodes].forEach(node => {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        frag.appendChild(/^\s+$/.test(part) ? document.createTextNode(part) : wrap(document.createTextNode(part)));
      });
      node.replaceWith(frag);
    } else if (node.nodeType === 1 && node.tagName !== 'BR') {
      const ph = document.createComment('');
      node.replaceWith(ph); ph.replaceWith(wrap(node));
    }
  });
  return [...el.querySelectorAll('.slp-w > span')];
}

export function initMotion(root, { reduced }) {
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const story = { q: 0 };

  /* ---- smooth scroll (wheel only; touch stays native) ---- */
  let lenis = null;
  if (!reduced && !window.__slpLenis && !matchMedia('(pointer: coarse)').matches) {
    lenis = new Lenis({ anchors: { offset: -72 }, stopInertiaOnNavigate: true, lerp: 0.11 });
    window.__slpLenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToEl = el => (lenis ? lenis.scrollTo(el, { offset: -72 }) : el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));

  /* ---- 3D story progress (scrub smooths the scroll into the model's pose) ---- */
  const bar = $('[data-story-bar]');
  gsap.to(story, {
    q: 1, ease: 'none',
    onUpdate: () => bar && (bar.style.transform = `scaleX(${story.q.toFixed(4)})`),
    scrollTrigger: { trigger: $('[data-scrolly]'), start: 'top top', end: 'bottom bottom', scrub: reduced ? true : 0.55 },
  });

  const mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 900px)', fine: '(pointer: fine)' }, ctx => {
    const { motion, desktop, fine } = ctx.conditions;
    if (!motion) return;

    /* hero entrance */
    const h1 = $('.slp-h1');
    const words = splitWords(h1);
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from('.slp-hero .slp-eyebrow', { y: 16, autoAlpha: 0, duration: 0.8 })
      .from(words, { yPercent: 115, duration: 1.1, stagger: 0.06 }, '<0.1')
      .from(['.slp-hero .slp-lead', '.slp-hero__ctas'], { y: 22, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, '<0.35')
      .from('.slp-hero__models', { y: 18, autoAlpha: 0, duration: 0.9 }, '<0.15');

    /* section headings: words rise as they enter */
    $$('.slp-sec .slp-h2, .slp-step .slp-h2').forEach(h => {
      const w = splitWords(h);
      gsap.from(w, { yPercent: 115, duration: 1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });

    /* count-ups on spec numbers */
    $$('[data-count]').forEach(el => {
      const to = +el.dataset.count, o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => (el.textContent = faDigits(Math.round(o.v))) });
    });

    /* product family: pinned horizontal gallery on desktop */
    if (desktop) {
      const sec = $('#slp-family'), rail = $('[data-rail]'), list = rail && rail.querySelector('.slp-rail__list');
      if (sec && list) {
        sec.classList.add('is-pinned');
        const dist = () => Math.max(0, list.scrollWidth - rail.clientWidth);
        gsap.to(list, {
          x: () => dist(), ease: 'none',   // RTL: the overflow sits on the left, so the track moves right
          scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true },
        });
        ctx.add(() => () => sec.classList.remove('is-pinned'));
      }
    }

    /* magnetic CTAs + pointer spotlights */
    if (fine) {
      $$('.slp-btn:not(.slp-btn--sm)').forEach(b => {
        const xTo = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3.out' }), yTo = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3.out' });
        const move = e => { const r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.25); yTo((e.clientY - r.top - r.height / 2) * 0.35); };
        const leave = () => { xTo(0); yTo(0); };
        b.addEventListener('pointermove', move); b.addEventListener('pointerleave', leave);
        ctx.add(() => () => { b.removeEventListener('pointermove', move); b.removeEventListener('pointerleave', leave); gsap.set(b, { x: 0, y: 0 }); });
      });
      const spot = e => {
        const c = e.target.closest('.slp-spot'); if (!c) return;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
      };
      root.addEventListener('pointermove', spot);
      ctx.add(() => () => root.removeEventListener('pointermove', spot));
    }
  });

  // fonts and the lazy 3D canvases change layout once; re-measure triggers after them
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  return { getProgress: () => story.q, scrollToEl, refresh: () => ScrollTrigger.refresh() };
}
