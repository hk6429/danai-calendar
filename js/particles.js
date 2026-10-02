export function spawnParticles(root, season, n = 12) {
  root.replaceChildren();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'); p.className = 'p ' + season;
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = 8 + Math.random() * 8 + 's';
    p.style.animationDelay = -Math.random() * 16 + 's';
    root.appendChild(p);
  }
}
