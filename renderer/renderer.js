/* global cursorcats */
(function () {
  const MARGIN = 8;
  const WALK_SPEED = 60; // px/s

  const canvas = document.getElementById('cat');
  const ctx = canvas.getContext('2d', { alpha: true });

  let manifest = null;
  let img = null;
  let dpr = 1;

  let x = 100;
  let y = 100;
  let state = 'idle';
  let idleEndAt = 0;
  let walkTargetX = 0;
  let walkTargetY = 0;
  let facingRight = true;

  let currentAnim = 'idle';
  let frameIndex = 0;
  let frameAccum = 0;
  let flipSprite = false;

  let lastFrameTime = 0;
  let rafStarted = false;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function getAnimDef(name) {
    if (!manifest || !manifest.animations) return null;
    return manifest.animations[name] || null;
  }

  function pickWalkAnim(moveRight) {
    if (moveRight) {
      if (getAnimDef('walk_right')) return { key: 'walk_right', flip: false };
      if (getAnimDef('walk_left')) return { key: 'walk_left', flip: true };
    } else {
      if (getAnimDef('walk_left')) return { key: 'walk_left', flip: false };
      if (getAnimDef('walk_right')) return { key: 'walk_right', flip: true };
    }
    return { key: 'idle', flip: false };
  }

  function getDrawSize() {
    const scale = manifest && typeof manifest.scale === 'number' ? manifest.scale : 1;
    const fw = (manifest && manifest.frameWidth) || 32;
    const fh = (manifest && manifest.frameHeight) || 32;
    return { w: fw * scale, h: fh * scale, fw, fh, scale };
  }

  function clampPos() {
    if (!manifest || !img) return;
    const { w, h } = getDrawSize();
    const maxX = Math.max(MARGIN, canvas.clientWidth - MARGIN - w);
    const maxY = Math.max(MARGIN, canvas.clientHeight - MARGIN - h);
    x = Math.min(maxX, Math.max(MARGIN, x));
    y = Math.min(maxY, Math.max(MARGIN, y));
  }

  function pickNewWalkTarget() {
    const { w, h } = getDrawSize();
    const maxX = Math.max(MARGIN, canvas.clientWidth - MARGIN - w);
    const maxY = Math.max(MARGIN, canvas.clientHeight - MARGIN - h);
    walkTargetX = rand(MARGIN, maxX);
    walkTargetY = rand(MARGIN, maxY);
  }

  function setupCanvasSize() {
    dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    clampPos();
  }

  function setAnim(name, flip) {
    if (name !== currentAnim) {
      currentAnim = name;
      frameIndex = 0;
      frameAccum = 0;
    }
    flipSprite = !!flip;
  }

  function advanceAnim(dt) {
    const anim = getAnimDef(currentAnim);
    if (!anim) return;
    const frames = Math.max(1, anim.frames | 0);
    const fps = anim.fps > 0 ? anim.fps : 8;
    frameAccum += dt;
    const step = 1 / fps;
    while (frameAccum >= step) {
      frameAccum -= step;
      frameIndex = (frameIndex + 1) % frames;
    }
  }

  function render() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    if (!img || !manifest) return;

    const anim = getAnimDef(currentAnim);
    if (!anim) return;

    const { w: destW, h: destH, fw, fh } = getDrawSize();
    const row = anim.row;
    const sxi = frameIndex * fw;
    const syi = row * fh;

    if (flipSprite) {
      ctx.save();
      ctx.translate(x + destW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sxi, syi, fw, fh, 0, 0, destW, destH);
      ctx.restore();
    } else {
      ctx.drawImage(img, sxi, syi, fw, fh, x, y, destW, destH);
    }
  }

  function gameLoop(ts) {
    if (!lastFrameTime) lastFrameTime = ts;
    const dt = Math.min(0.1, (ts - lastFrameTime) / 1000);
    lastFrameTime = ts;

    if (img && manifest) {
      if (state === 'idle') {
        if (getAnimDef('idle')) {
          setAnim('idle', false);
          advanceAnim(dt);
        }
        if (ts >= idleEndAt) {
          state = 'walk';
          pickNewWalkTarget();
        }
      } else if (state === 'walk') {
        const tx = walkTargetX;
        const ty = walkTargetY;
        const dx = tx - x;
        const dy = ty - y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const move = WALK_SPEED * dt;
        if (dist < 0.5 || move >= dist) {
          x = tx;
          y = ty;
          state = 'idle';
          idleEndAt = ts + rand(1000, 3000);
        } else {
          const mx = (dx / dist) * move;
          const my = (dy / dist) * move;
          x += mx;
          y += my;
        }
        if (state === 'walk') {
          facingRight = walkTargetX >= x;
          const wk = pickWalkAnim(facingRight);
          if (getAnimDef(wk.key)) {
            setAnim(wk.key, wk.flip);
            advanceAnim(dt);
          } else {
            setAnim('idle', false);
            advanceAnim(dt);
          }
        }
        clampPos();
      }
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  window.addEventListener('resize', () => {
    setupCanvasSize();
  });

  async function boot() {
    setupCanvasSize();
    if (!window.cursorcats) {
      // eslint-disable-next-line no-console
      console.error('cursorcats API missing (preload not loaded?)');
      if (!rafStarted) {
        rafStarted = true;
        requestAnimationFrame(gameLoop);
      }
      return;
    }
    try {
      const text = await window.cursorcats.readTextFile('assets/cats/sprite.json');
      manifest = JSON.parse(text);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('No or invalid assets/cats/sprite.json', e);
      manifest = null;
    }
    if (!manifest || !manifest.image) {
      if (!rafStarted) {
        rafStarted = true;
        requestAnimationFrame(gameLoop);
      }
      return;
    }
    try {
      const url = await window.cursorcats.getAssetFileUrl(`assets/cats/${manifest.image}`);
      const im = new Image();
      await new Promise((resolve, reject) => {
        im.onload = () => resolve();
        im.onerror = reject;
        im.src = url;
      });
      img = im;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load sprite image — add your PNG to assets/cats/', e);
      img = null;
    }
    if (img && getAnimDef('idle')) {
      const { w, h } = getDrawSize();
      x = rand(MARGIN, Math.max(MARGIN, canvas.clientWidth - MARGIN - w));
      y = rand(MARGIN, Math.max(MARGIN, canvas.clientHeight - MARGIN - h));
      idleEndAt = performance.now() + rand(1000, 3000);
    }
    if (!rafStarted) {
      rafStarted = true;
      requestAnimationFrame(gameLoop);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
