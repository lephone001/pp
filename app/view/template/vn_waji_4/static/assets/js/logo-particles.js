(function () {
  "use strict";
  const stage = document.querySelector("[data-logo-particles]");
  if (!stage || stage.dataset.particlesReady) return;
  stage.dataset.particlesReady = "true";
  const image = stage.querySelector("img");
  const config = {
    particleCount: Math.max(300, Math.min(20000, Number(stage.dataset.particleCount) || 5000)),
    stationaryCount: Math.max(300, Math.min(10000, Number(stage.dataset.stationaryCount) || 1000)),
    speed: Math.max(0.5, Math.min(2, Number(stage.dataset.animationSpeed) || 1))
  };
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const canvas = document.createElement("canvas");
  canvas.className = "header-logo-particles__moving";
  const stationaryCanvas = document.createElement("canvas");
  stationaryCanvas.className = "header-logo-particles__stationary";
  const sweep = document.createElement("span");
  sweep.className = "header-logo-particles__sweep";
  [stationaryCanvas, canvas, sweep].forEach(function (layer) {
    layer.setAttribute("aria-hidden", "true");
    stage.appendChild(layer);
  });
  const context = canvas.getContext("2d", { alpha: true });
  const stationaryContext = stationaryCanvas.getContext("2d", { alpha: true });
  if (!context || !stationaryContext) return;
  const TAU = Math.PI * 2;
  const alphaThreshold = 72;
  const pools = [[], [], []];
  const allPixels = [];
  let pixelData = null, imageWidth = 0, imageHeight = 0;
  let particles = [], stationaryParticles = [];
  let stageWidth = 1, stageHeight = 1;
  let elapsed = 0, phase = "gather", rafId = 0, timerId = 0;
  let initialized = false, running = false, inView = true, pageActive = true;
  let clockOrigin = 0, lastFrame = -Infinity;
  function random(min, max) { return min + Math.random() * (max - min); }
  function clamp01(value) { return Math.min(1, Math.max(0, value)); }
  function smooth(value) { const t = clamp01(value); return t * t * (3 - 2 * t); }
    function classify(r, g, b) {
      if (r > 75 && g > 40 && g > r * 0.34 && b < g * 1.2 && r >= b) return 2;
      if (b > r * 1.08 || b > g * 1.3) return 1;
      return 0;
    }

    function readOriginalPixels() {
      imageWidth = image.naturalWidth;
      imageHeight = image.naturalHeight;
      const offscreen = document.createElement("canvas");
      offscreen.width = imageWidth;
      offscreen.height = imageHeight;
      const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
      offscreenContext.drawImage(image, 0, 0);
      pixelData = offscreenContext.getImageData(0, 0, imageWidth, imageHeight).data;

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = imageWidth;
      maskCanvas.height = imageHeight;
      const maskContext = maskCanvas.getContext("2d");
      const mask = maskContext.createImageData(imageWidth, imageHeight);
      for (let pixel = 0; pixel < imageWidth * imageHeight; pixel += 1) {
        const index = pixel * 4;
        const alpha = pixelData[index + 3];
        if (alpha <= alphaThreshold) continue;
        if (Math.max(pixelData[index], pixelData[index + 1], pixelData[index + 2]) < 80) continue;
        const kind = classify(pixelData[index], pixelData[index + 1], pixelData[index + 2]);
        pools[kind].push(pixel);
        allPixels.push(pixel);
        if (kind === 2) {
          mask.data[index] = 255;
          mask.data[index + 1] = 255;
          mask.data[index + 2] = 255;
          mask.data[index + 3] = alpha;
        }
      }
      maskContext.putImageData(mask, 0, 0);
      const maskUrl = 'url("' + maskCanvas.toDataURL("image/png") + '")';
      sweep.style.maskImage = maskUrl;
      sweep.style.webkitMaskImage = maskUrl;
      if (!allPixels.length) throw new Error("Logo 没有可采样的不透明像素");
    }

    function spawn(particle) {
      const angle = particle.kind === 0 ? random(TAU * 0.2, TAU * 0.8)
        : particle.kind === 1 ? random(-TAU * 0.3, TAU * 0.3) : random(0, TAU);
      const radius = random(0.8, 1.35);
      particle.sx = 0.5 + Math.cos(angle) * radius;
      particle.sy = 0.5 + Math.sin(angle) * radius;
      particle.delay = particle.kind === 2 ? random(150, 1050) : random(0, 850);
      particle.duration = particle.kind === 2 ? random(1550, 2250) : random(1300, 1850);
      particle.phase = random(0, TAU);
      particle.turns = random(0.75, 1.85) * (Math.random() < 0.5 ? -1 : 1);
      particle.spiral = random(0.015, 0.055);
      particle.rotation = random(0, TAU);
      particle.opacity = random(0.7, 1);
      particle.size = random(1.5, particle.kind === 2 ? 3.3 : 4.1);
      particle.shape = Math.floor(random(0, 3));
      particle.sparkle = Math.random() < (particle.kind === 2 ? 0.2 : 0.075);
    }

    function sampleCoverage(count, offset, irregular = false) {
      // Give each occupied cell a target before distributing extra particles by area.
      let grid = Math.max(1, Math.floor(Math.sqrt(count)));
      let cells;
      for (;;) {
        const bins = new Map();
        allPixels.forEach(function (pixel) {
          const x = pixel % imageWidth;
          const y = Math.floor(pixel / imageWidth);
          const key = Math.floor((y + 0.5) * grid / imageHeight) * grid + Math.floor((x + 0.5) * grid / imageWidth);
          if (!bins.has(key)) bins.set(key, []);
          bins.get(key).push(pixel);
        });
        if (bins.size > count && cells) {
          grid = cells.grid;
          cells = cells.bins;
          break;
        }
        if (bins.size >= count * 0.85 || grid >= Math.max(imageWidth, imageHeight)) {
          cells = bins;
          break;
        }
        cells = { grid: grid, bins: bins };
        grid = Math.min(Math.max(imageWidth, imageHeight), Math.ceil(grid * 1.15));
      }
      const targets = [];
      cells.forEach(function (pixels) {
        targets.push(pixels[Math.min(pixels.length - 1, Math.floor(pixels.length * (irregular ? Math.random() : offset)))]);
      });
      const remaining = count - targets.length;
      for (let i = 0; i < remaining; i += 1) {
        const index = Math.min(allPixels.length - 1, Math.floor(irregular ? Math.random() * allPixels.length : (i + offset) * allPixels.length / remaining));
        targets.push(allPixels[index]);
      }
      return targets.map(function (pixel) {
        const index = pixel * 4;
        const particle = {
          kind: classify(pixelData[index], pixelData[index + 1], pixelData[index + 2]),
          tx: (pixel % imageWidth + 0.5) / imageWidth,
          ty: (Math.floor(pixel / imageWidth) + 0.5) / imageHeight,
          color: "rgb(" + pixelData[index] + "," + pixelData[index + 1] + "," + pixelData[index + 2] + ")",
          pixelAlpha: pixelData[index + 3] / 255,
          coverageRadius: 0.85 / grid
        };
        spawn(particle);
        if (irregular) {
          const sizeVariation = random(0.4, 1.6);
          particle.size *= sizeVariation;
          particle.coverageRadius *= sizeVariation;
          particle.pixelAlpha *= random(0.65, 1);
        }
        return particle;
      });
    }

    function buildParticles() {
      particles = sampleCoverage(config.particleCount, 0.25);
      stationaryParticles = sampleCoverage(config.stationaryCount, 0.75, true);
      renderStationaryParticles();
    }

    function renderStationaryParticles() {
      stationaryContext.clearRect(0, 0, stageWidth, stageHeight);
      stationaryParticles.forEach(function (particle) {
        drawParticle(particle, particle.tx * stageWidth, particle.ty * stageHeight,
          1, particle.pixelAlpha, stationaryContext);
      });
      stationaryContext.globalAlpha = 1;
      stationaryContext.globalCompositeOperation = "destination-in";
      stationaryContext.drawImage(image, 0, 0, stageWidth, stageHeight);
      stationaryContext.globalCompositeOperation = "source-over";
    }

    function resizeCanvas() {
      const bounds = stage.getBoundingClientRect();
      stageWidth = Math.max(1, bounds.width);
      stageHeight = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(stageWidth * 3 * ratio);
      canvas.height = Math.round(stageHeight * 3 * ratio);
      context.setTransform(ratio, 0, 0, ratio, stageWidth * ratio, stageHeight * ratio);
      stationaryCanvas.width = Math.round(stageWidth * ratio);
      stationaryCanvas.height = Math.round(stageHeight * ratio);
      stationaryContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderStationaryParticles();
      if (initialized && !canvas.hidden && phase === "gather") renderParticles(elapsed);
    }

    function drawParticle(particle, x, y, progress, alpha, drawingContext = context) {
      const size = particle.size * Math.min(stageWidth, stageHeight) / 550
        * (drawingContext === context ? 3 : 0.25);
      drawingContext.fillStyle = particle.color;
      if (progress >= 0.98) {
        drawingContext.globalAlpha = alpha;
        drawingContext.beginPath();
        drawingContext.arc(x, y, particle.coverageRadius * Math.min(stageWidth, stageHeight)
          * (drawingContext === context ? 1.25 : 0.25), 0, TAU);
        drawingContext.fill();
      }
      if (particle.sparkle) {
        drawingContext.globalAlpha = alpha * 0.15;
        drawingContext.beginPath();
        drawingContext.arc(x, y, size * 2.2, 0, TAU);
        drawingContext.fill();
      }
      drawingContext.globalAlpha = alpha;
      if (particle.shape === 2) {
        drawingContext.beginPath();
        drawingContext.arc(x, y, size * 0.68, 0, TAU);
        drawingContext.fill();
        return;
      }
      const angle = particle.rotation + particle.turns * progress * TAU;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      drawingContext.beginPath();
      if (particle.shape === 0) {
        drawingContext.moveTo(x + cosine * size, y + sine * size);
        drawingContext.lineTo(x + (-cosine * 0.65 - sine * 0.6) * size, y + (-sine * 0.65 + cosine * 0.6) * size);
        drawingContext.lineTo(x + (-cosine * 0.65 + sine * 0.6) * size, y + (-sine * 0.65 - cosine * 0.6) * size);
      } else {
        drawingContext.moveTo(x + cosine * size, y + sine * size);
        drawingContext.lineTo(x - sine * size * 0.7, y + cosine * size * 0.7);
        drawingContext.lineTo(x - cosine * size, y - sine * size);
        drawingContext.lineTo(x + sine * size * 0.7, y - cosine * size * 0.7);
      }
      drawingContext.closePath();
      drawingContext.fill();
    }

    function renderParticles(time) {
      context.clearRect(-stageWidth, -stageHeight, stageWidth * 3, stageHeight * 3);
      const fade = 1 - smooth((time - 3000) / 1000);
      const extent = Math.min(stageWidth, stageHeight);
      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        const local = time - particle.delay;
        if (local <= 0) continue;
        const progress = clamp01(local / particle.duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const spiral = Math.sin(Math.PI * progress) * (1 - progress) * particle.spiral * extent;
        const angle = particle.phase + particle.turns * progress * TAU;
        const x = (particle.sx + (particle.tx - particle.sx) * eased) * stageWidth + Math.cos(angle) * spiral;
        const y = (particle.sy + (particle.ty - particle.sy) * eased) * stageHeight + Math.sin(angle) * spiral;
        const alpha = Math.min(1, local / 180) * fade * particle.opacity * particle.pixelAlpha;
        if (alpha > 0.01) drawParticle(particle, x, y, progress, alpha);
      }
      context.globalAlpha = 1;
      image.style.opacity = String(smooth((time - 3000) / 1000));
    }


  function clearScheduled() {
    cancelAnimationFrame(rafId);
    clearTimeout(timerId);
    rafId = timerId = 0;
  }
  function canRun() {
    return initialized && pageActive && inView && !document.hidden && !motion.matches;
  }
  function schedule(boundary, callback) {
    timerId = window.setTimeout(callback, Math.max(0, (boundary - elapsed) / config.speed));
  }
  function enterHold() {
    phase = "hold";
    elapsed = 5000;
    sweep.classList.remove("is-sweeping", "is-paused");
    image.style.opacity = "1";
    schedule(10000, startCycle);
  }
  function enterSweep() {
    phase = "sweep";
    elapsed = 4000;
    canvas.hidden = true;
    image.style.opacity = "1";
    sweep.style.setProperty("--sweep-duration", (1000 / config.speed) + "ms");
    sweep.classList.remove("is-sweeping", "is-paused");
    void sweep.offsetWidth;
    sweep.classList.add("is-sweeping");
    schedule(5000, enterHold);
  }
  function frame(now) {
    if (!running) return;
    elapsed = Math.min(4000, (now - clockOrigin) * config.speed);
    if (now - lastFrame >= 1000 / (mobile ? 24 : 30) || elapsed >= 4000) {
      renderParticles(elapsed);
      lastFrame = now;
    }
    if (elapsed >= 4000) enterSweep();
    else rafId = requestAnimationFrame(frame);
  }
  function startCycle() {
    clearScheduled();
    elapsed = 0;
    phase = "gather";
    particles.forEach(spawn);
    clockOrigin = performance.now();
    lastFrame = -Infinity;
    sweep.classList.remove("is-sweeping", "is-paused");
    canvas.hidden = false;
    renderParticles(0);
    if (canRun()) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  }
  function pause() {
    if (!running) return;
    elapsed = Math.min(10000, (performance.now() - clockOrigin) * config.speed);
    running = false;
    clearScheduled();
    sweep.classList.add("is-paused");
  }
  function syncPlayback() {
    if (!canRun()) {
      pause();
      if (motion.matches) {
        image.style.opacity = "1";
        canvas.hidden = true;
        sweep.classList.remove("is-sweeping");
      }
      return;
    }
    if (running) return;
    running = true;
    clockOrigin = performance.now() - elapsed / config.speed;
    if (phase === "gather") {
      canvas.hidden = false;
      renderParticles(elapsed);
      lastFrame = -Infinity;
      rafId = requestAnimationFrame(frame);
    } else if (phase === "sweep") {
      sweep.classList.remove("is-paused");
      if (!sweep.classList.contains("is-sweeping")) {
        sweep.style.setProperty("--sweep-duration", ((5000 - elapsed) / config.speed) + "ms");
        sweep.classList.add("is-sweeping");
      }
      schedule(5000, enterHold);
    } else schedule(10000, startCycle);
  }
  function ready() {
    if (initialized) return;
    try {
      readOriginalPixels();
      buildParticles();
      resizeCanvas();
      initialized = true;
      syncPlayback();
    } catch (error) {
      image.style.opacity = "1";
      canvas.hidden = true;
      stationaryCanvas.hidden = true;
      sweep.hidden = true;
      console.warn("Header Logo animation unavailable:", error);
    }
  }
  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("pagehide", function () { pageActive = false; pause(); });
  window.addEventListener("pageshow", function () { pageActive = true; syncPlayback(); });
  if (motion.addEventListener) motion.addEventListener("change", syncPlayback);
  else if (motion.addListener) motion.addListener(syncPlayback);
  if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(stage);
  else window.addEventListener("resize", resizeCanvas, { passive: true });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      syncPlayback();
    }).observe(stage);
  }
  if (image.complete && image.naturalWidth) ready();
  else image.addEventListener("load", ready, { once: true });
})();
