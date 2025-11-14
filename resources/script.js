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
