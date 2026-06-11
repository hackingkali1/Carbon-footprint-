(function spawnNature() {
"use strict";
  const leafColors = ['#5cba8a', '#7ed4a8', '#40916c', '#a8e6c4', '#3a8f60', '#74c69d'];
  const leafContainer = document.getElementById('leafContainer');
  const fireflyContainer = document.getElementById('fireflyContainer');
  const NUM_LEAVES = 18;
  const NUM_FIREFLIES = 12;

  if (!leafContainer || !fireflyContainer) return;

  // Leaves
  for (let i = 0; i < NUM_LEAVES; i++) {
    const leaf = document.createElement('div');
    leaf.className = 'leaf-particle';
    const size = 10 + Math.random() * 18;
    const color = leafColors[Math.floor(Math.random() * leafColors.length)];
    const duration = 9 + Math.random() * 14;
    const delay = -Math.random() * duration;
    const drift = (Math.random() - 0.5) * 180;
    const rot = 360 + Math.random() * 360;
    const leftPct = Math.random() * 95;
    leaf.style.cssText = [
      `left:${leftPct}%`,
      `--lw:${size}px`,
      `--lh:${size * 0.85}px`,
      `--lc:${color}`,
      `--ld:${duration}s`,
      `--ldelay:${delay}s`,
      `--ldrift:${drift}px`,
      `--lrot:${rot}deg`,
    ].join(';');
    leafContainer.appendChild(leaf);
  }

  // Fireflies
  for (let i = 0; i < NUM_FIREFLIES; i++) {
    const ff = document.createElement('div');
    ff.className = 'firefly';
    const size = 3 + Math.random() * 5;
    const duration = 4 + Math.random() * 8;
    const delay = -Math.random() * duration;
    const fx = (Math.random() - 0.5) * 120;
    const fy = -(30 + Math.random() * 100);
    ff.style.cssText = [
      `width:${size}px`,
      `height:${size}px`,
      `left:${5 + Math.random() * 90}%`,
      `top:${10 + Math.random() * 75}%`,
      `animation-duration:${duration}s`,
      `animation-delay:${delay}s`,
      `--fx:${fx}px`,
      `--fy:${fy}px`,
    ].join(';');
    fireflyContainer.appendChild(ff);
  }
})();
