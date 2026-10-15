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
  // screen readers keep one clean name; the split words are decoration
  el.setAttribute('aria-label', [...el.childNodes].map(n => (n.nodeName === 'BR' ? ' ' : n.textContent)).join('').replace(/\s+/g, ' ').trim());
  const wrap = node => { const o = document.createElement('span'); o.className = 'slp-w'; o.setAttribute('aria-hidden', 'true'); const i = document.createElement('span'); o.appendChild(i); i.appendChild(node); return o; };
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
  const bar = $('[data-story-bar]'), stage = $('[data-stage]'), chapters = $$('[data-chapter]');
  let activeCh = -2;
  const syncStory = () => {
    const q = story.q;
    if (bar) bar.style.transform = `scaleX(${q.toFixed(4)})`;
    if (stage) stage.style.setProperty('--q', q.toFixed(3));
    // chapter rail: hero, then glass / inside / family
    const ch = q < 0.16 ? -1 : q < 0.52 ? 0 : q < 0.86 ? 1 : 2;
    if (ch !== activeCh) { activeCh = ch; chapters.forEach((c, i) => c.classList.toggle('is-on', i === ch)); }
  };
  syncStory();
  gsap.to(story, {
    q: 1, ease: 'none',
    onUpdate: syncStory,
    scrollTrigger: { trigger: $('[data-scrolly]'), start: 'top top', end: 'bottom bottom', scrub: reduced ? true : 0.55 },
  });

  const mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 900px)', fine: '(pointer: fine)' }, ctx => {
    const { motion, desktop, fine } = ctx.conditions;
    if (!motion) return;

    /* hero entrance */
    const h1 = $('.slp-h1');
    const words = h1 ? splitWords(h1) : [];
    const intro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    const pick = sel => [...root.querySelectorAll(sel)];
    if (pick('.slp-hero__copy .slp-eyebrow').length) intro.from(pick('.slp-hero__copy .slp-eyebrow'), { y: 16, autoAlpha: 0, duration: 0.8 });
    intro.from(words, { yPercent: 115, autoAlpha: 0, filter: 'blur(8px)', duration: 1.1, stagger: 0.06 }, '<0.1');
    const rest = pick('.slp-hero__copy .slp-lead, .slp-hero__copy .slp-hero__ctas');
    if (rest.length) intro.from(rest, { y: 22, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, '<0.35');
    if (pick('.slp-hero__models').length) intro.from(pick('.slp-hero__models'), { y: 18, autoAlpha: 0, duration: 0.9 }, '<0.15');

    /* preloader: the brand glyph draws itself, the curtain lifts, then the hero plays.
       Hard cap at 2.4 s so a slow device never waits behind it. */
    // runs as CSS animations (compositor), so heavy start-up work can't make it skip frames
    const pre = $('[data-preloader]');
    if (pre) {
      let done = false;
      const finish = () => { if (done) return; done = true; pre.remove(); intro.play(); };
      pre.addEventListener('animationend', e => e.animationName === 'slp-lift' && finish());
      setTimeout(finish, 2800);
    } else intro.play();

    /* experience: the room settles into frame as it arrives */
    $$('.slp-room').forEach(r => gsap.fromTo(r, { scale: 1.07, autoAlpha: 0.4 }, { scale: 1, autoAlpha: 1, ease: 'none',
      scrollTrigger: { trigger: r, start: 'top bottom', end: 'top 35%', scrub: 1 } }));

    /* footer rises out from behind the last section */
    $$('.slp-foot').forEach(f => gsap.fromTo(f, { yPercent: -30, autoAlpha: 0.6 }, { yPercent: 0, autoAlpha: 1, ease: 'none',
      scrollTrigger: { trigger: f, start: 'top bottom', end: 'top 70%', scrub: 1 } }));

    /* section headings: words rise as they enter */
    $$('.slp-sec .slp-h2, .slp-step .slp-h2').forEach(h => {
      const w = splitWords(h);
      gsap.from(w, { yPercent: 115, autoAlpha: 0, filter: 'blur(6px)', duration: 1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });

    /* count-ups on spec numbers */
    $$('[data-count]').forEach(el => {
      const to = +el.dataset.count, o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => (el.textContent = faDigits(Math.round(o.v))) });
    });

    /* product family: pinned horizontal gallery on desktop */
    if (desktop && root.dataset.design !== 'c') {
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
