(function () {
  "use strict";

  const layer = document.getElementById("energy-ribbon-layer");
  const toggle = document.getElementById("energy-ribbon-toggle");
  if (!layer || !toggle || document.body.classList.contains("site-error-page")) return;

  // Match the defaults in app/public/demos/pixi-neon-ribbons.html.
  const config = { speed: 0.62, amplitude: 58, width: 34, glow: 0.85 };
  const pixiUrl = "https://cdn.jsdelivr.net/npm/pixi.js@8.22.0/dist/pixi.min.mjs";
  const segments = 240;
  const vertexShader = `
      precision highp float;
      attribute vec2 aPosition;
      attribute vec2 aUV;
      uniform vec2 uResolution;
      uniform vec2 uOrigin;
      uniform float uTime;
      uniform float uLane;
      uniform float uSpeed;
      uniform float uAmplitude;
      uniform float uRibbonWidth;
      uniform float uPhase;
      varying float vT;
      varying float vAcross;
      varying float vFade;
      varying float vPhase;
      void main(void) {
        float t = aPosition.x;
        float side = aPosition.y;
        float lane = uLane - 0.5;
        vec2 redEnd = vec2(-uResolution.x * 0.08, uResolution.y * 0.35);
        vec2 blueEnd = vec2(uResolution.x * 0.64, -uResolution.y * 0.08);
        vec2 endpoint = mix(redEnd, blueEnd, uLane);
        vec2 source = uOrigin + vec2(17.0 * uLane, 0.0);
        vec2 blueControl = vec2(source.x, mix(source.y, endpoint.y, 0.4));
        vec2 tangent = mix(endpoint - source,
          2.0 * mix(blueControl - source, endpoint - blueControl, t), uLane);
        vec2 normal = normalize(vec2(-tangent.y, tangent.x));
        float flowTime = -uTime;
        float wave = sin(t * 5.2 - flowTime * uSpeed + uPhase);
        wave += 0.42 * sin(t * 11.6 - flowTime * uSpeed * 0.68 + uPhase * 1.53);
        wave += 0.18 * sin(t * 2.25 + flowTime * uSpeed * 0.22 + uPhase * 2.1);
        vec2 straight = mix(source, endpoint, t);
        vec2 blueCurve = mix(mix(source, blueControl, t), mix(blueControl, endpoint, t), t);
        vec2 center = mix(straight, blueCurve, uLane);
        float fanSpread = lane * uResolution.x * 0.11 * pow(t, 1.8);
        float flowEnvelope = sin(3.14159 * t) * smoothstep(0.0, 0.18, t);
        float waveEnvelope = flowEnvelope * (0.58 + 0.42 * t);
        float slowSway = sin(t * 3.0 - flowTime * 0.19 + uPhase * 1.7) * uAmplitude * 0.2 * flowEnvelope;
        center += normal * (fanSpread + wave * uAmplitude * waveEnvelope + slowSway);
        float widthPulse = 1.0 + 0.16 * sin(t * 8.4 - flowTime * uSpeed * 0.72 + uPhase * 1.4);
        float taper = smoothstep(0.0, 0.018, t);
        float halfWidth = uRibbonWidth * (0.24 + 3.9 * pow(t, 1.6)) * widthPulse * taper;
        vec2 position = center + normal * side * halfWidth;
        vec2 clipPosition = vec2(position.x / uResolution.x * 2.0 - 1.0, 1.0 - position.y / uResolution.y * 2.0);
        gl_Position = vec4(clipPosition, 0.0, 1.0);
        vT = aUV.x;
        vAcross = side;
        vFade = mix(1.0, 0.12, smoothstep(0.0, 1.0, t));
        vPhase = uPhase;
      }
    `;
  const fragmentShader = `
      precision highp float;
      varying float vT;
      varying float vAcross;
      varying float vFade;
      varying float vPhase;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uGlow;
      uniform float uOpacity;
      uniform vec3 uRibbonColor;
      uniform vec3 uAccent;
      void main(void) {
        float across = abs(vAcross);
        float body = exp(-pow(across * 1.52, 4.0));
        float core = exp(-pow(across / 0.105, 2.0));
        float rim = exp(-pow((across - 0.78) / 0.15, 2.0));
        float edgeCore = exp(-pow((across - 0.965) / 0.045, 2.0));
        float flowTime = -uTime;
        float grain = 0.5 + 0.5 * sin(vT * 118.0 - flowTime * uSpeed * 3.15 + sin(vT * 16.0 + vPhase) * 2.4);
        float filamentWave = 0.5 + 0.5 * sin(vT * 39.0 - flowTime * uSpeed * 2.4 + vPhase + sin(vT * 9.0) * 1.7);
        float filament = exp(-pow((across - (0.34 + 0.075 * sin(vT * 8.0 - flowTime * 0.26 + vPhase))) / 0.055, 2.0)) * filamentWave;
        float shimmer = pow(max(0.0, sin(vT * 31.0 - flowTime * uSpeed * 2.0 + vPhase + sin(vT * 7.0) * 1.3)), 18.0);
        float blend = smoothstep(0.08, 0.95, vT) * 0.58;
        vec3 color = mix(uRibbonColor, uAccent, blend);
        color = mix(color, vec3(0.94, 0.91, 1.0), clamp(core * 0.42 + edgeCore * 0.3 + shimmer * 0.58, 0.0, 0.82));
        color += uAccent * (rim * 0.18 + filament * 0.26 + shimmer * 0.2) * uGlow;
        float sourceGlow = exp(-pow(vT / 0.12, 2.0));
        float alpha = (body * 0.24 + core * 0.25 + rim * 0.22 + edgeCore * 0.18 + filament * 0.2 + shimmer * 0.26) + sourceGlow * 0.28;
        alpha *= vFade * uOpacity * (0.88 + grain * 0.12) * (0.78 + uGlow * 0.22);
        float finalAlpha = clamp(alpha, 0.0, 0.9);
        gl_FragColor = vec4(color * (1.0 + uGlow * 0.28) * finalAlpha, finalAlpha);
      }
    `;

  let app = null;
  let ribbons = [];
  let elapsed = 0;
  let loading = null;
  let running = false;
  let enabled = false;
  let destroyed = false;

  function viewport() {
    return [Math.max(1, layer.clientWidth), Math.max(1, layer.clientHeight)];
  }

  function origin() {
    const source = toggle.getBoundingClientRect();
    const bounds = layer.getBoundingClientRect();
    return [source.left + source.width / 2 - bounds.left,
      source.top + source.height / 2 - bounds.top];
  }

  function updatePosition() {
    if (!app) return;
    const size = viewport();
    const source = origin();
    ribbons.forEach(function (ribbon) {
      const u = ribbon.uniforms.uniforms;
      u.uResolution[0] = size[0];
      u.uResolution[1] = size[1];
      u.uOrigin[0] = source[0];
      u.uOrigin[1] = source[1];
    });
  }

  function releaseRenderer() {
    window.removeEventListener("resize", updatePosition);
    layer.hidden = true;
    const currentApp = app;
    app = null;
    running = false;
    ribbons = [];
    elapsed = 0;
    if (!currentApp) return;

    const canvas = currentApp.canvas;
    try {
      currentApp.stop();
      currentApp.ticker.remove(tick);
      currentApp.destroy({ removeView: true }, { children: true, context: true });
    } catch (error) {
      console.warn("Energy ribbons cleanup failed:", error);
    } finally {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  function createGeometry(pixi) {
    const positions = new Float32Array((segments + 1) * 4);
    const uvs = new Float32Array((segments + 1) * 4);
    const indices = new Uint32Array(segments * 6);
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const v = i * 4;
      positions[v] = t;
      positions[v + 1] = -1;
      positions[v + 2] = t;
      positions[v + 3] = 1;
      uvs[v] = t;
      uvs[v + 1] = 0;
      uvs[v + 2] = t;
      uvs[v + 3] = 1;
      if (i < segments) {
        const a = i * 2;
        const k = i * 6;
        indices[k] = a;
        indices[k + 1] = a + 1;
        indices[k + 2] = a + 2;
        indices[k + 3] = a + 1;
        indices[k + 4] = a + 3;
        indices[k + 5] = a + 2;
      }
    }
    return new pixi.Geometry({
      attributes: { aPosition: positions, aUV: uvs },
      indexBuffer: indices
    });
  }

  function createUniforms(pixi, lane, phase, color, accent) {
    const size = viewport();
    return new pixi.UniformGroup({
      uResolution: { value: new Float32Array(size), type: "vec2<f32>" },
      uOrigin: { value: new Float32Array(origin()), type: "vec2<f32>" },
      uTime: { value: 0, type: "f32" },
      uLane: { value: lane, type: "f32" },
      uSpeed: { value: config.speed, type: "f32" },
      uAmplitude: { value: config.amplitude, type: "f32" },
      uRibbonWidth: { value: config.width, type: "f32" },
      uPhase: { value: phase, type: "f32" },
      uGlow: { value: config.glow, type: "f32" },
      uOpacity: { value: 1.0, type: "f32" },
      // Pixi Mesh owns uColor (vec4); keep this RGB palette uniform separate.
      uRibbonColor: { value: new Float32Array(color), type: "vec3<f32>" },
      uAccent: { value: new Float32Array(accent), type: "vec3<f32>" }
    });
  }

  function createScene(pixi) {
    const geometry = createGeometry(pixi);
    const colors = [
      [[1.0, 0.045, 0.16], [1.0, 0.29, 0.57]],
      [[0.035, 0.39, 1.0], [0.22, 0.88, 1.0]]
    ];
    colors.forEach(function (palette, lane) {
      // The demo assigns red lane 0 and blue lane 1, which sends them to
      // separate endpoints and spreads the two trajectories apart.
      const uniforms = createUniforms(pixi, lane, lane * 2.399, palette[0], palette[1]);
      const shader = pixi.Shader.from({
        gl: { vertex: vertexShader, fragment: fragmentShader },
        resources: { ribbonUniforms: uniforms }
      });
      const mesh = new pixi.Mesh({ geometry: geometry, shader: shader });
      mesh.blendMode = "normal";
      app.stage.addChild(mesh);
      ribbons.push({ mesh: mesh, uniforms: uniforms });
    });
    updatePosition();
  }

  function tick(ticker) {
    updatePosition();
    elapsed += Math.min(ticker.deltaMS || 16.67, 80) / 1000;
    ribbons.forEach(function (ribbon) {
      ribbon.uniforms.uniforms.uTime = elapsed;
    });
  }

  function syncButton() {
    toggle.classList.toggle("is-active", enabled);
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.setAttribute("aria-label", enabled ? "Tắt hiệu ứng ánh sáng" : "Bật hiệu ứng ánh sáng");
  }

  async function initialize() {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2", { alpha: true, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL2 is unavailable");
    const loseContext = gl.getExtension("WEBGL_lose_context");
    if (loseContext) loseContext.loseContext();

    const pixi = await import(pixiUrl);
    if (destroyed || !enabled) return;
    const candidate = new pixi.Application();
    try {
      await candidate.init({
        preference: "webgl",
        preferWebGLVersion: 2,
        resizeTo: window,
        resolution: 1,
        autoDensity: true,
        backgroundAlpha: 0,
        antialias: true,
        clearBeforeRender: true,
        powerPreference: "low-power",
        autoStart: false,
        sharedTicker: false
      });
    } catch (error) {
      try {
        candidate.destroy({ removeView: true }, { children: true, context: true });
      } catch (cleanupError) {
        console.warn("Energy ribbons initialization cleanup failed:", cleanupError);
      }
      throw error;
    }
    if (destroyed || !enabled) {
      try {
        candidate.destroy({ removeView: true }, { children: true, context: true });
      } catch (error) {
        console.warn("Energy ribbons cancelled initialization cleanup failed:", error);
      }
      return;
    }
    app = candidate;
    app.canvas.setAttribute("aria-hidden", "true");
    layer.appendChild(app.canvas);
    app.ticker.maxFPS = mobile ? 24 : 30;
    app.ticker.minFPS = 15;
    createScene(pixi);
    app.ticker.add(tick);
    window.addEventListener("resize", updatePosition, { passive: true });
  }

  function start() {
    if (destroyed) return;
    enabled = true;
    syncButton();
    if (document.hidden) return;
    if (app) {
      layer.hidden = false;
      updatePosition();
      if (!running) app.start();
      running = true;
      return;
    }
    if (loading) return;
    loading = initialize().then(function () {
      if (enabled && !document.hidden && app) start();
    }).catch(function (error) {
      enabled = false;
      releaseRenderer();
      layer.hidden = true;
      syncButton();
      console.warn("Energy ribbons could not start:", error);
    }).finally(function () {
      loading = null;
      if (enabled && !document.hidden && !app) start();
    });
  }

  function stop() {
    enabled = false;
    releaseRenderer();
    layer.hidden = true;
    syncButton();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      releaseRenderer();
    } else if (enabled) {
      start();
    }
  }

  function destroy() {
    destroyed = true;
    enabled = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("resize", updatePosition);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
    releaseRenderer();
  }

  function onPageHide(event) {
    if (event.persisted) {
      releaseRenderer();
    } else {
      destroy();
    }
  }

  function onPageShow(event) {
    if (event.persisted && enabled) start();
  }

  toggle.addEventListener("click", function () {
    if (enabled) stop();
    else start();
  });
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  syncButton();

  const mobile = window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pagePath = window.location.pathname.replace(/\/+$/, "") || "/";
  const isHomePage = pagePath === "/" || pagePath === "/index" ||
    pagePath === "/index.html" || pagePath === "/index.htm" || pagePath === "/c";
  if (isHomePage && !reducedMotion) start();
})();
