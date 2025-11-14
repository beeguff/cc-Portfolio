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
