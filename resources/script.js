// Change project section background color on card hover
document.addEventListener('DOMContentLoaded', () => {
  const projectSection = document.querySelector('.projectSection');
  const cards = document.querySelectorAll('.projectCard');

  cards.forEach(card => {
    // Get the computed color variable for this card
    const cardColor = getComputedStyle(card).getPropertyValue('--projColor');

    // Mouse enters: change the section background
    card.addEventListener('mouseenter', () => {
      projectSection.style.backgroundColor = cardColor;
    });

    // Mouse leaves: reset background to default
    card.addEventListener('mouseleave', () => {
      projectSection.style.backgroundColor = '';
    });
  });
});

// Navigation bar appearance based on scroll position
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('nav');
  const hero = document.querySelector('.hero');
  if (!nav || !hero) return;

  // Create a sentinel inside the hero ~70vh from the top
  const sentinel = document.createElement('div');
  sentinel.style.position = 'absolute';
  sentinel.style.top = '70vh';          // <— trigger early
  sentinel.style.left = '0';
  sentinel.style.right = '0';
  sentinel.style.height = '1px';
  sentinel.style.pointerEvents = 'none';
  hero.style.position = hero.style.position || 'relative';
  hero.appendChild(sentinel);

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        nav.classList.remove('nav-on');
      } else {
        nav.classList.add('nav-on');
      }
    },
    {
      root: null,
      threshold: 0,
    }
  );

  observer.observe(sentinel);
});

// GSAP Animations

// 1GSAP Draggable with fling physics on .aboutImageWrapper
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.aboutContainer');
  const frame = document.querySelector('.aboutImageWrapper');
  if (!container || !frame) return;

  gsap.registerPlugin(Draggable);

  // Make sure transforms don’t fight other animations
  gsap.set(frame, { rotate: 0, scale: 1 });

  const samples = [];
  const SAMPLE_WINDOW_MS = 120; // last 120ms to estimate velocity
  let physicsStop = null;

  const drag = Draggable.create(frame, {
    type: 'x,y',
    bounds: container,           // critical: lets Draggable compute proper min/max
    edgeResistance: 0.65,
    allowContextMenu: true,
      zIndexBoost: false,
    onPress() {
      // stop any active fling
      if (physicsStop) physicsStop();
      samples.length = 0;
      pushSample();
    },
    onDrag() {
      pushSample();
    },
    onRelease() {
      // refresh bounds (in case layout changed while dragging)
      drag.update(true);
      const { vx, vy } = estimateVelocity();
      startFling(vx, vy);
    }
  })[0];

  // Recompute Draggable’s bounds on resize
  window.addEventListener('resize', () => drag && drag.update(true));

  function pushSample() {
    const now = performance.now();
    const x = gsap.getProperty(frame, 'x');
    const y = gsap.getProperty(frame, 'y');
    samples.push({ t: now, x, y });
    while (samples.length && now - samples[0].t > SAMPLE_WINDOW_MS) samples.shift();
  }

  function estimateVelocity() {
    if (samples.length < 2) return { vx: 0, vy: 0 };
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    return {
      vx: dt ? (last.x - first.x) / dt : 0, // px/s
      vy: dt ? (last.y - first.y) / dt : 0
    };
  }

  function startFling(vx, vy) {
    const speed0 = Math.hypot(vx, vy);
    if (speed0 < 60) return; // ignore tiny releases

    // Use Draggable’s computed bounds (can be negative!)
    let { minX, maxX, minY, maxY } = drag;

    // Current transform positions
    let x = gsap.getProperty(frame, 'x');
    let y = gsap.getProperty(frame, 'y');

    // Physics constants
    const FRICTION = 0.94;    // velocity decay per tick
    const BOUNCE = 0.6;       // energy retained on bounce
    const STOP_SPEED = 20;    // px/s to stop
    const DT = 1 / 60;

    let running = true;

    const tick = () => {
      // integrate
      x += vx * DT;
      y += vy * DT;

      // bounce using Draggable’s bounds
      if (x < minX) { x = minX; vx = -vx * BOUNCE; }
      else if (x > maxX) { x = maxX; vx = -vx * BOUNCE; }
      if (y < minY) { y = minY; vy = -vy * BOUNCE; }
      else if (y > maxY) { y = maxY; vy = -vy * BOUNCE; }

      // friction
      vx *= FRICTION;
      vy *= FRICTION;

      // apply
      gsap.set(frame, { x, y });

      // stop when slow and resting at/near an edge
      if (Math.hypot(vx, vy) < STOP_SPEED && (x <= minX || x >= maxX || y <= minY || y >= maxY)) {
        stop();
      }
    };

    function stop() {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
      physicsStop = null;
      gsap.to(frame, { x, y, duration: 0.15, ease: 'power2.out' });
    }

    // if user presses again, kill the fling
    physicsStop = stop;
    gsap.ticker.add(tick);
  }
});



// 3GSAP Inertia hover effect on .tool elements

document.addEventListener('DOMContentLoaded', () => {
  try { gsap.registerPlugin(InertiaPlugin); } catch (e) {}

  const root = document.querySelector('.toolGrid');
  if (!root) return;

  let oldX = 0, oldY = 0, deltaX = 0, deltaY = 0;

  // Track mouse movement velocity
  root.addEventListener('mousemove', (e) => {
    deltaX = e.clientX - oldX;
    deltaY = e.clientY - oldY;
    oldX = e.clientX;
    oldY = e.clientY;
  }, { passive: true });

  // ---- knobs you can tweak ----
  const VEL_MULT   = 12;            // was 20 — lower = shorter fling
  const VEL_CLAMP  = 25;            // clamp raw mouse delta before multiplying
  const RESISTANCE = 1500;          // higher = stops sooner (InertiaPlugin)
  const MAX_DUR    = 0.45;          // cap flight time (InertiaPlugin)

  const PUSH_MULT  = 4;             // fallback push strength (was 6)
  const PUSH_CLAMP = 30;            // fallback max px (was 50)
  // -----------------------------

  root.querySelectorAll('.tool').forEach((tile) => {
    gsap.set(tile, { willChange: 'transform', transformOrigin: '50% 50%' });

    tile.addEventListener('mouseenter', () => {
      gsap.killTweensOf(tile);

      const wiggle = {
        duration: 0.35,
        rotate: (Math.random() - 0.5) * 16, // tighter tilt
        yoyo: true,
        repeat: 1,
        ease: 'power1.inOut',
        scale: 1.03
      };

      if (gsap.plugins.InertiaPlugin) {
        // clamp the recent mouse delta before turning into velocity
        const vx = gsap.utils.clamp(-VEL_CLAMP, VEL_CLAMP, deltaX) * VEL_MULT;
        const vy = gsap.utils.clamp(-VEL_CLAMP, VEL_CLAMP, deltaY) * VEL_MULT;

        const tl = gsap.timeline({ onComplete() { tl.kill(); } });
        tl.to(tile, {
          inertia: {
            x: { velocity: vx, end: 0, resistance: RESISTANCE },
            y: { velocity: vy, end: 0, resistance: RESISTANCE }
          },
          duration: MAX_DUR // cap how long the inertia runs
        });
        tl.fromTo(tile, { rotate: 0, scale: 1 }, wiggle, '<');
      } else {
        // fallback: smaller push & clamp
        const pushX = gsap.utils.clamp(-PUSH_CLAMP, PUSH_CLAMP, deltaX * PUSH_MULT);
        const pushY = gsap.utils.clamp(-PUSH_CLAMP, PUSH_CLAMP, deltaY * PUSH_MULT);

        const tl = gsap.timeline({ onComplete() { tl.kill(); } });
        tl.to(tile, { x: `+=${pushX}`, y: `+=${pushY}`, duration: 0.16, ease: 'power2.out' })
          .to(tile, { x: 0, y: 0, duration: 0.4, ease: 'power3.out' }, '>');
        tl.fromTo(tile, { rotate: 0, scale: 1 }, wiggle, '<');
      }
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
    const heroTitle = document.querySelector('.heroText h1');
    
    if (!heroTitle) return;

    // 1. Split the text into spans
    const text = heroTitle.textContent;
    const chars = text.split('').map(char => {
        // Preserve spaces by using a non-breaking space or ensuring the span has width
        return char === ' ' ? '<span>&nbsp;</span>' : `<span>${char}</span>`;
    }).join('');
    
    heroTitle.innerHTML = chars;
    const spans = heroTitle.querySelectorAll('span');

    // 2. Configuration
    const maxDist = 200;   // The radius of influence (in px)
    const minWeight = 400; // Base font weight (Resting state)
    const maxWeight = 800; // Peak font weight (Hover state)

    // 3. Mouse Move Logic
    heroTitle.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        spans.forEach(span => {
            // Get the center of the letter
            const rect = span.getBoundingClientRect();
            const spanX = rect.left + (rect.width / 2);
            const spanY = rect.top + (rect.height / 2);

            // Calculate distance (Hypotenuse)
            const dist = Math.hypot(mouseX - spanX, mouseY - spanY);

            // Map distance to weight
            // If distance is 0, weight is maxWeight. If distance is > maxDist, weight is minWeight.
            let targetWeight = gsap.utils.mapRange(0, maxDist, maxWeight, minWeight, dist);

            // Clamp the value so it doesn't go below minWeight
            targetWeight = gsap.utils.clamp(minWeight, maxWeight, targetWeight);

            // Animate smoothly
            gsap.to(span, {
                fontWeight: targetWeight,
                duration: 0.2,  // Short duration for snappy feel
                overwrite: 'auto'
            });
        });
    });

    // 4. Reset on Mouse Leave
    heroTitle.addEventListener('mouseleave', () => {
        gsap.to(spans, {
            fontWeight: minWeight,
            duration: 0.5,
            ease: 'power2.out'
        });
    });
});