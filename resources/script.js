document.addEventListener('DOMContentLoaded', () => {
  
    // 1. NAV SCROLL OBSERVER (Kept the optimization here as it was purely functional)
    const nav = document.querySelector('nav');
    const hero = document.querySelector('.hero');
    
    if (nav && hero) {
        const sentinel = document.createElement('div');
        Object.assign(sentinel.style, {
            position: 'absolute', top: '70vh', left: '0', right: '0', height: '1px', pointerEvents: 'none'
        });
        hero.style.position = hero.style.position || 'relative';
        hero.appendChild(sentinel);

        const navObserver = new IntersectionObserver(([entry]) => {
            nav.classList.toggle('nav-on', !entry.isIntersecting);
        }, { root: null, threshold: 0 });

        navObserver.observe(sentinel);
    }

    // 2. PROJECT BACKGROUND EFFECTS
    const projectSection = document.querySelector('.projectSection');
    const cards = document.querySelectorAll('.projectCard');
    
    // Check for hover capability to prevent sticky hover states on mobile
    if (projectSection && window.matchMedia('(hover: hover)').matches) {
        const bgOverlay = document.createElement('div');
        bgOverlay.classList.add('project-bg-overlay');
        projectSection.appendChild(bgOverlay);

        cards.forEach(card => {
            const cardColor = getComputedStyle(card).getPropertyValue('--projColor');
            const imgSrc = card.querySelector('img')?.src || '';

            card.addEventListener('mouseenter', () => {
                projectSection.style.backgroundColor = cardColor;
                if (imgSrc) {
                    bgOverlay.style.backgroundImage = `url(${imgSrc})`;
                    bgOverlay.style.opacity = '0.15';
                }
            });

            card.addEventListener('mouseleave', () => {
                projectSection.style.backgroundColor = '';
                bgOverlay.style.opacity = '0';
            });
        });
    }

    // 3. HERO FONT WEIGHT PROXIMITY
    // Only run on devices with a mouse (pointer: fine) to save battery on mobile
    if (window.matchMedia('(pointer: fine)').matches) {
        const heroTitle = document.querySelector('.heroText h1');
        
        if (heroTitle) {
            const text = heroTitle.textContent;
            // Re-wrap logic
            heroTitle.innerHTML = text.split('').map(char => 
                char === ' ' ? '<span>&nbsp;</span>' : `<span>${char}</span>`
            ).join('');
            
            const spans = heroTitle.querySelectorAll('span');
            const maxDist = 150; 
            const minWeight = 500; 
            const maxWeight = 900; 
        
            heroTitle.addEventListener('mousemove', (e) => {
                const mouseX = e.clientX;
                const mouseY = e.clientY;
        
                spans.forEach(span => {
                    const rect = span.getBoundingClientRect();
                    const spanX = rect.left + (rect.width / 2);
                    const spanY = rect.top + (rect.height / 2);
                    const dist = Math.hypot(mouseX - spanX, mouseY - spanY);
                    let targetWeight = gsap.utils.mapRange(0, maxDist, maxWeight, minWeight, dist);
                    targetWeight = gsap.utils.clamp(minWeight, maxWeight, targetWeight);
        
                    gsap.to(span, {
                        fontWeight: targetWeight,
                        duration: 0.2,
                        overwrite: 'auto'
                    });
                });
            });
        
            heroTitle.addEventListener('mouseleave', () => {
                gsap.to(spans, {
                    fontWeight: minWeight,
                    duration: 0.2,
                    ease: 'power3.out'
                });
            });
        }
    }

    // 4. RESTORED: FLING PHYSICS (About Image)
    // Wrapped in a check to prevent it from fighting vertical page scrolling on mobile
    if (window.matchMedia("(min-width: 1024px)").matches) {
        gsap.registerPlugin(Draggable);
        const container = document.querySelector('.aboutContainer');
        const frame = document.querySelector('.aboutImageWrapper');

        if (container && frame) {
            gsap.set(frame, { rotate: 0, scale: 1 });

            const samples = [];
            const SAMPLE_WINDOW_MS = 120;
            let physicsStop = null;

            const drag = Draggable.create(frame, {
                type: 'x,y',
                bounds: container,
                edgeResistance: 0.65,
                allowContextMenu: true,
                zIndexBoost: false,
                onPress() {
                    if (physicsStop) physicsStop();
                    samples.length = 0;
                    pushSample();
                },
                onDrag() { pushSample(); },
                onRelease() {
                    drag.update(true);
                    const { vx, vy } = estimateVelocity();
                    startFling(vx, vy);
                }
            })[0];

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
                    vx: dt ? (last.x - first.x) / dt : 0,
                    vy: dt ? (last.y - first.y) / dt : 0
                };
            }

            function startFling(vx, vy) {
                const speed0 = Math.hypot(vx, vy);
                if (speed0 < 60) return;

                let { minX, maxX, minY, maxY } = drag;
                let x = gsap.getProperty(frame, 'x');
                let y = gsap.getProperty(frame, 'y');

                const FRICTION = 0.94;
                const BOUNCE = 0.6;
                const STOP_SPEED = 20;
                const DT = 1 / 60;

                let running = true;

                const tick = () => {
                    x += vx * DT;
                    y += vy * DT;

                    if (x < minX) { x = minX; vx = -vx * BOUNCE; }
                    else if (x > maxX) { x = maxX; vx = -vx * BOUNCE; }
                    if (y < minY) { y = minY; vy = -vy * BOUNCE; }
                    else if (y > maxY) { y = maxY; vy = -vy * BOUNCE; }

                    vx *= FRICTION;
                    vy *= FRICTION;

                    gsap.set(frame, { x, y });

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

                physicsStop = stop;
                gsap.ticker.add(tick);
            }
        }
    }

    // 5. RESTORED: COMPLEX TOOL INERTIA
    // Wrapped so it only runs on desktop (mouse)
    if (window.matchMedia("(min-width: 1024px)").matches) {
        try { gsap.registerPlugin(InertiaPlugin); } catch (e) {}

        const root = document.querySelector('.toolGrid');
        if (root) {
            let oldX = 0, oldY = 0, deltaX = 0, deltaY = 0;

            root.addEventListener('mousemove', (e) => {
                deltaX = e.clientX - oldX;
                deltaY = e.clientY - oldY;
                oldX = e.clientX;
                oldY = e.clientY;
            }, { passive: true });

            const VEL_MULT = 12;
            const VEL_CLAMP = 25;
            const RESISTANCE = 1500;
            const MAX_DUR = 0.45;
            const PUSH_MULT = 4;
            const PUSH_CLAMP = 30;

            root.querySelectorAll('.tool').forEach((tile) => {
                gsap.set(tile, { willChange: 'transform', transformOrigin: '50% 50%' });

                tile.addEventListener('mouseenter', () => {
                    gsap.killTweensOf(tile);

                    const wiggle = {
                        duration: 0.35,
                        rotate: (Math.random() - 0.5) * 16,
                        yoyo: true,
                        repeat: 1,
                        ease: 'power1.inOut',
                        scale: 1.03
                    };

                    if (gsap.plugins.InertiaPlugin) {
                        const vx = gsap.utils.clamp(-VEL_CLAMP, VEL_CLAMP, deltaX) * VEL_MULT;
                        const vy = gsap.utils.clamp(-VEL_CLAMP, VEL_CLAMP, deltaY) * VEL_MULT;

                        const tl = gsap.timeline({ onComplete() { tl.kill(); } });
                        tl.to(tile, {
                            inertia: {
                                x: { velocity: vx, end: 0, resistance: RESISTANCE },
                                y: { velocity: vy, end: 0, resistance: RESISTANCE }
                            },
                            duration: MAX_DUR
                        });
                        tl.fromTo(tile, { rotate: 0, scale: 1 }, wiggle, '<');
                    } else {
                        const pushX = gsap.utils.clamp(-PUSH_CLAMP, PUSH_CLAMP, deltaX * PUSH_MULT);
                        const pushY = gsap.utils.clamp(-PUSH_CLAMP, PUSH_CLAMP, deltaY * PUSH_MULT);

                        const tl = gsap.timeline({ onComplete() { tl.kill(); } });
                        tl.to(tile, { x: `+=${pushX}`, y: `+=${pushY}`, duration: 0.16, ease: 'power2.out' })
                          .to(tile, { x: 0, y: 0, duration: 0.4, ease: 'power3.out' }, '>');
                        tl.fromTo(tile, { rotate: 0, scale: 1 }, wiggle, '<');
                    }
                });
            });
        }
    }
});