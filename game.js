/**
 * TmDrake Fire — purple dragon shooter
 * tmdrake-style dragon, sombrero enemies, power-ups, menu, WebAudio SFX
 */

(() => {
  "use strict";

  // ---------- DOM ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const waveEl = document.getElementById("wave");
  const hpEl = document.getElementById("hp");
  const powerEl = document.getElementById("power");
  const bestEl = document.getElementById("best-score");

  const menu = document.getElementById("menu");
  const howto = document.getElementById("howto");
  const btnPlay = document.getElementById("btn-play");
  const btnHowto = document.getElementById("btn-howto");
  const btnSound = document.getElementById("btn-sound");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayMsg = document.getElementById("overlay-msg");
  const overlayEmoji = document.getElementById("overlay-emoji");
  const overlayBtn = document.getElementById("overlay-btn");
  const overlayMenu = document.getElementById("overlay-menu");

  const W = canvas.width;
  const H = canvas.height;

  // ---------- Audio (Web Audio API — no files needed) ----------
  const audio = {
    ctx: null,
    enabled: true,
    master: null,
  };

  function ensureAudio() {
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.22;
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === "suspended") audio.ctx.resume();
  }

  function beep(freq, dur, type = "square", vol = 0.4, slide = 0) {
    if (!audio.enabled) return;
    ensureAudio();
    if (!audio.ctx) return;
    const t0 = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  const sfx = {
    shoot: () => {
      beep(420, 0.06, "square", 0.18, -180);
      beep(680, 0.05, "sawtooth", 0.08, -200);
    },
    hit: () => beep(180, 0.08, "triangle", 0.25, -80),
    kill: () => {
      beep(220, 0.1, "square", 0.2, 120);
      beep(440, 0.12, "triangle", 0.15, 200);
    },
    hurt: () => {
      beep(140, 0.18, "sawtooth", 0.3, -60);
      beep(90, 0.22, "square", 0.2, -40);
    },
    power: () => {
      beep(523, 0.08, "sine", 0.25, 0);
      beep(659, 0.1, "sine", 0.22, 0);
      beep(784, 0.14, "sine", 0.2, 0);
    },
    wave: () => {
      beep(330, 0.12, "triangle", 0.2, 100);
      setTimeout(() => beep(440, 0.14, "triangle", 0.18, 80), 80);
    },
    gameOver: () => {
      beep(300, 0.2, "sawtooth", 0.25, -100);
      setTimeout(() => beep(200, 0.25, "sawtooth", 0.22, -80), 120);
      setTimeout(() => beep(120, 0.35, "triangle", 0.2, -40), 260);
    },
    ui: () => beep(600, 0.05, "sine", 0.15, 0),
  };

  // ---------- State ----------
  const state = {
    mode: "menu", // menu | play | pause | gameover
    score: 0,
    best: Number(localStorage.getItem("tmdrake_fire_best") || 0),
    wave: 1,
    lives: 3,
    invuln: 0,
    spawnTimer: 0,
    enemiesThisWave: 0,
    enemiesToSpawn: 6,
    enemiesKilled: 0,
    shake: 0,
    time: 0,
    // power-ups
    shield: 0,
    rapid: 0,
    multi: 0,
    powerSpawnTimer: 4,
  };

  const keys = new Set();
  let mouseDown = false;

  const player = {
    x: W * 0.18,
    y: H * 0.5,
    w: 58,
    h: 42,
    speed: 290,
    fireCooldown: 0,
    baseFireRate: 0.16,
  };

  let bullets = [];
  let enemies = [];
  let particles = [];
  let pickups = [];
  let stars = [];
  let clouds = [];
  let floatTexts = [];

  // ---------- Helpers ----------
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function hearts(n) {
    return "♥".repeat(Math.max(0, n)) || "—";
  }

  function powerLabel() {
    const bits = [];
    if (state.shield > 0) bits.push("🛡");
    if (state.rapid > 0) bits.push("⚡");
    if (state.multi > 0) bits.push("✦");
    return bits.length ? bits.join(" ") : "—";
  }

  function updateHud() {
    scoreEl.textContent = String(state.score);
    waveEl.textContent = String(state.wave);
    hpEl.textContent = hearts(state.lives);
    powerEl.textContent = powerLabel();
    bestEl.textContent = String(state.best);
  }

  function setSoundButton() {
    btnSound.textContent = audio.enabled ? "Sound: On" : "Sound: Off";
  }

  function showMenu() {
    state.mode = "menu";
    menu.classList.remove("hidden");
    overlay.classList.add("hidden");
    updateHud();
  }

  function hideMenus() {
    menu.classList.add("hidden");
    overlay.classList.add("hidden");
  }

  function showOverlay(title, msg, btnLabel, emoji = "🟣🐉") {
    overlayTitle.textContent = title;
    overlayMsg.innerHTML = msg;
    overlayBtn.textContent = btnLabel;
    overlayEmoji.textContent = emoji;
    overlay.classList.remove("hidden");
  }

  function burst(x, y, color, count = 12, speed = 180) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.3, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.7),
        max: 0.7,
        r: rand(1.5, 4.5),
        color,
      });
    }
  }

  function floatText(x, y, text, color = "#e9d5ff") {
    floatTexts.push({ x, y, text, color, life: 0.9, max: 0.9 });
  }

  // ---------- Combat ----------
  function fireRate() {
    return state.rapid > 0 ? player.baseFireRate * 0.45 : player.baseFireRate;
  }

  function shoot() {
    if (player.fireCooldown > 0 || state.mode !== "play") return;
    player.fireCooldown = fireRate();
    sfx.shoot();

    const base = {
      x: player.x + player.w * 0.45,
      y: player.y,
      vx: 540,
      life: 1.5,
      kind: "player",
    };

    if (state.multi > 0) {
      // Triple purple volley
      const angles = [-0.18, 0, 0.18];
      for (const ang of angles) {
        bullets.push({
          ...base,
          y: player.y + ang * 40,
          vx: Math.cos(ang) * 540,
          vy: Math.sin(ang) * 420,
          r: 6,
          color: "#d8b4fe",
        });
      }
    } else {
      bullets.push({
        ...base,
        vy: 0,
        r: 7,
        color: "#c084fc",
      });
      bullets.push({
        x: player.x + player.w * 0.3,
        y: player.y - 7,
        vx: 500,
        vy: -35,
        r: 4,
        life: 1.0,
        color: "#a855f7",
        kind: "player",
      });
      bullets.push({
        x: player.x + player.w * 0.3,
        y: player.y + 7,
        vx: 500,
        vy: 35,
        r: 4,
        life: 1.0,
        color: "#a855f7",
        kind: "player",
      });
    }

    burst(player.x + player.w * 0.5, player.y, "#c084fc", 4, 70);
  }

  function spawnEnemy() {
    const roll = Math.random();
    // Sombrero-themed foes
    let type = "mariachi"; // small flyer with hat
    if (state.wave >= 2 && roll > 0.5) type = "bandito";
    if (state.wave >= 4 && roll > 0.78) type = "vaquero";
    if (state.wave >= 6 && roll > 0.92) type = "el_jefe";

    const table = {
      mariachi: { w: 36, h: 32, hp: 1, score: 10, vx: -125 - state.wave * 8 },
      bandito: { w: 42, h: 38, hp: 3, score: 25, vx: -95 - state.wave * 5 },
      vaquero: { w: 50, h: 40, hp: 5, score: 50, vx: -72 - state.wave * 4 },
      el_jefe: { w: 72, h: 56, hp: 16, score: 140, vx: -48 - state.wave * 2 },
    };
    const stats = table[type];
    const bonusHp = Math.floor((state.wave - 1) / 2);

    enemies.push({
      x: W + 40,
      y: rand(45, H - 45),
      w: stats.w,
      h: stats.h,
      vx: stats.vx,
      vy: rand(-40, 40),
      hp: stats.hp + bonusHp,
      maxHp: stats.hp + bonusHp,
      type,
      t: Math.random() * Math.PI * 2,
      score: stats.score,
    });
  }

  function spawnPickup(x, y, forced) {
    const types = ["shield", "rapid", "multi", "heal"];
    const type = forced || types[Math.floor(Math.random() * types.length)];
    const colors = {
      shield: "#7dd3fc",
      rapid: "#fde047",
      multi: "#e9d5ff",
      heal: "#fca5a5",
    };
    pickups.push({
      x,
      y,
      r: 12,
      type,
      color: colors[type],
      life: 10,
      t: 0,
      vy: rand(-20, 20),
    });
  }

  function applyPickup(type) {
    sfx.power();
    if (type === "shield") {
      state.shield = 8;
      floatText(player.x, player.y - 30, "SHIELD!", "#7dd3fc");
    } else if (type === "rapid") {
      state.rapid = 7;
      floatText(player.x, player.y - 30, "RAPID FIRE!", "#fde047");
    } else if (type === "multi") {
      state.multi = 8;
      floatText(player.x, player.y - 30, "TRIPLE SHOT!", "#e9d5ff");
    } else if (type === "heal") {
      if (state.lives < 5) {
        state.lives += 1;
        floatText(player.x, player.y - 30, "+1 HEART", "#fca5a5");
      } else {
        state.score += 50;
        floatText(player.x, player.y - 30, "+50", "#fca5a5");
      }
    }
    updateHud();
  }

  function nextWave() {
    state.wave += 1;
    state.enemiesThisWave = 0;
    state.enemiesKilled = 0;
    state.enemiesToSpawn = 6 + state.wave * 2;
    state.spawnTimer = 1.3;
    sfx.wave();
    if (state.wave % 3 === 1 && state.lives < 5) {
      state.lives = Math.min(5, state.lives + 1);
    }
    // Wave gift
    if (state.wave % 2 === 0) {
      spawnPickup(W * 0.45, H * 0.5);
    }
    updateHud();
  }

  function damagePlayer() {
    if (state.invuln > 0) return;
    if (state.shield > 0) {
      state.shield = 0;
      state.invuln = 0.8;
      state.shake = 6;
      burst(player.x, player.y, "#7dd3fc", 16, 200);
      sfx.hit();
      floatText(player.x, player.y - 24, "Shield broke!", "#7dd3fc");
      updateHud();
      return;
    }
    state.lives -= 1;
    state.invuln = 1.4;
    state.shake = 10;
    updateHud();
    burst(player.x, player.y, "#ff7b9c", 20, 220);
    sfx.hurt();
    if (state.lives <= 0) endGame();
  }

  function endGame() {
    state.mode = "gameover";
    sfx.gameOver();
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("tmdrake_fire_best", String(state.best));
    }
    updateHud();
    showOverlay(
      "The Dragon Falls",
      `Score <strong>${state.score}</strong> · Wave <strong>${state.wave}</strong><br/>Best: <strong>${state.best}</strong>`,
      "Rise Again",
      "💀🟣"
    );
  }

  function resetGame() {
    state.mode = "play";
    state.score = 0;
    state.wave = 1;
    state.lives = 3;
    state.invuln = 0;
    state.spawnTimer = 0.7;
    state.enemiesThisWave = 0;
    state.enemiesToSpawn = 6;
    state.enemiesKilled = 0;
    state.shake = 0;
    state.time = 0;
    state.shield = 0;
    state.rapid = 0;
    state.multi = 0;
    state.powerSpawnTimer = 5;
    bullets = [];
    enemies = [];
    particles = [];
    pickups = [];
    floatTexts = [];
    player.x = W * 0.18;
    player.y = H * 0.5;
    player.fireCooldown = 0;
    updateHud();
    hideMenus();
    ensureAudio();
    sfx.ui();
  }

  function seedBackground() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vy: 20 + Math.random() * 60,
        size: 0.8 + Math.random() * 2,
        alpha: 0.25 + Math.random() * 0.7,
        drift: (Math.random() - 0.5) * 10,
      });
    }
    clouds = [];
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 40 + Math.random() * 90,
        a: 0.05 + Math.random() * 0.08,
      });
    }
  }

  function updateStars(dt) {
    for (const s of stars) {
      s.y += s.vy * dt * 0.15;
      s.x += s.drift * dt;
      if (s.y > H) {
        s.y = -2;
        s.x = Math.random() * W;
      }
      if (s.x < 0) s.x += W;
      if (s.x > W) s.x -= W;
    }
    for (const c of clouds) {
      c.x -= (30 + c.s * 0.15) * dt;
      if (c.x < -c.s * 2) {
        c.x = W + c.s;
        c.y = Math.random() * H;
      }
    }
  }

  // ---------- Update ----------
  function update(dt) {
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.invuln > 0) state.invuln -= dt;
    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (state.shield > 0) state.shield = Math.max(0, state.shield - dt);
    if (state.rapid > 0) state.rapid = Math.max(0, state.rapid - dt);
    if (state.multi > 0) state.multi = Math.max(0, state.multi - dt);
    updateHud();

    let mx = 0;
    let my = 0;
    if (keys.has("arrowleft") || keys.has("a")) mx -= 1;
    if (keys.has("arrowright") || keys.has("d")) mx += 1;
    if (keys.has("arrowup") || keys.has("w")) my -= 1;
    if (keys.has("arrowdown") || keys.has("s")) my += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      player.x += (mx / len) * player.speed * dt;
      player.y += (my / len) * player.speed * dt;
    }
    player.x = clamp(player.x, 30, W * 0.55);
    player.y = clamp(player.y, 30, H - 40);

    if (keys.has(" ") || mouseDown) shoot();

    // Enemies
    if (state.enemiesThisWave < state.enemiesToSpawn) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.enemiesThisWave += 1;
        state.spawnTimer = Math.max(0.35, 1.1 - state.wave * 0.05);
      }
    } else if (enemies.length === 0 && state.enemiesKilled >= state.enemiesToSpawn) {
      nextWave();
    }

    // Random mid-wave pickups
    state.powerSpawnTimer -= dt;
    if (state.powerSpawnTimer <= 0) {
      spawnPickup(rand(W * 0.35, W * 0.75), rand(60, H - 60));
      state.powerSpawnTimer = rand(7, 12);
    }

    for (const e of enemies) {
      e.t += dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt + Math.sin(e.t * 2.5) * 20 * dt;
      if (e.y < 30 || e.y > H - 30) e.vy *= -1;

      if ((e.type === "vaquero" || e.type === "el_jefe") && Math.random() < dt * 0.55) {
        bullets.push({
          x: e.x - e.w * 0.3,
          y: e.y,
          vx: -220 - state.wave * 8,
          vy: (player.y - e.y) * 0.35,
          r: e.type === "el_jefe" ? 7 : 5,
          life: 3,
          color: e.type === "el_jefe" ? "#f59e0b" : "#fbbf24",
          kind: "enemy",
        });
      }
    }
    enemies = enemies.filter((e) => e.x > -80);

    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    bullets = bullets.filter(
      (b) => b.life > 0 && b.x > -20 && b.x < W + 40 && b.y > -20 && b.y < H + 20
    );

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const pk of pickups) {
      pk.t += dt;
      pk.life -= dt;
      pk.x -= 35 * dt;
      pk.y += Math.sin(pk.t * 3) * 30 * dt + pk.vy * dt;
    }
    pickups = pickups.filter((p) => p.life > 0 && p.x > -30);

    for (const f of floatTexts) {
      f.y -= 28 * dt;
      f.life -= dt;
    }
    floatTexts = floatTexts.filter((f) => f.life > 0);

    // Pickup collision
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      if (Math.hypot(pk.x - player.x, pk.y - player.y) < pk.r + 22) {
        applyPickup(pk.type);
        burst(pk.x, pk.y, pk.color, 14, 160);
        pickups.splice(i, 1);
      }
    }

    // Player bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.kind !== "player") continue;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.abs(b.x - e.x) < e.w * 0.45 + b.r && Math.abs(b.y - e.y) < e.h * 0.45 + b.r) {
          e.hp -= 1;
          bullets.splice(i, 1);
          burst(b.x, b.y, "#d8b4fe", 6, 120);
          sfx.hit();
          if (e.hp <= 0) {
            state.score += e.score;
            state.enemiesKilled += 1;
            updateHud();
            burst(e.x, e.y, e.type === "el_jefe" ? "#f59e0b" : "#c084fc", 18, 240);
            state.shake = Math.max(state.shake, e.type === "el_jefe" ? 8 : 4);
            sfx.kill();
            if (Math.random() < (e.type === "el_jefe" ? 0.9 : 0.18)) {
              spawnPickup(e.x, e.y);
            }
            enemies.splice(j, 1);
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.kind !== "enemy") continue;
      if (
        Math.abs(b.x - player.x) < player.w * 0.35 + b.r &&
        Math.abs(b.y - player.y) < player.h * 0.35 + b.r
      ) {
        bullets.splice(i, 1);
        damagePlayer();
      }
    }

    for (const e of enemies) {
      if (
        Math.abs(e.x - player.x) < (e.w + player.w) * 0.28 &&
        Math.abs(e.y - player.y) < (e.h + player.h) * 0.3
      ) {
        damagePlayer();
      }
    }
  }

  // ---------- Drawing ----------
  function paintBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1e0b3a");
    g.addColorStop(0.45, "#15082a");
    g.addColorStop(1, "#0a0614");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Purple moon
    ctx.beginPath();
    ctx.fillStyle = "rgba(216, 180, 254, 0.14)";
    ctx.arc(W * 0.78, H * 0.18, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "rgba(192, 132, 252, 0.22)";
    ctx.arc(W * 0.78, H * 0.18, 34, 0, Math.PI * 2);
    ctx.fill();

    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#ede9fe";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    for (const c of clouds) {
      ctx.fillStyle = `rgba(140, 100, 200, ${c.a})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.s, c.s * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.s * 0.4, c.y - 8, c.s * 0.7, c.s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(10, 6, 20, 0.9)";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let gx = 0; gx <= W; gx += 20) {
      const gy =
        H - 28 - Math.sin(gx * 0.01 + state.time * 0.3) * 6 - Math.sin(gx * 0.03) * 10;
      ctx.lineTo(gx, gy);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  /** tmdrake-style purple dragon */
  function drawDragon(x, y, flash = false) {
    ctx.save();
    ctx.translate(x, y);

    // Soft aura
    const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 48);
    aura.addColorStop(0, "rgba(168, 85, 247, 0.35)");
    aura.addColorStop(1, "rgba(168, 85, 247, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-22, -12, 26, 16);
    body.addColorStop(0, flash ? "#f3e8ff" : "#c084fc");
    body.addColorStop(0.45, flash ? "#e9d5ff" : "#9333ea");
    body.addColorStop(1, flash ? "#d8b4fe" : "#4c1d95");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 23, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly scale stripe (tmdrake mark)
    ctx.fillStyle = flash ? "#faf5ff" : "#e9d5ff";
    ctx.beginPath();
    ctx.ellipse(3, 5, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? "#ddd6fe" : "#a78bfa";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0 + i * 5, 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head
    ctx.fillStyle = flash ? "#f5e8ff" : "#a855f7";
    ctx.beginPath();
    ctx.ellipse(21, -4, 13, 10, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.beginPath();
    ctx.moveTo(30, -2);
    ctx.lineTo(42, 1);
    ctx.lineTo(30, 5);
    ctx.closePath();
    ctx.fill();

    // Crest / "drake" horns — twin purple horns with gold tips
    ctx.fillStyle = flash ? "#fff" : "#7e22ce";
    ctx.beginPath();
    ctx.moveTo(14, -11);
    ctx.lineTo(10, -24);
    ctx.lineTo(18, -12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, -12);
    ctx.lineTo(22, -26);
    ctx.lineTo(26, -11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0c35a";
    ctx.beginPath();
    ctx.arc(10, -24, 2, 0, Math.PI * 2);
    ctx.arc(22, -26, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eye — bright amber
    ctx.fillStyle = "#1e1033";
    ctx.beginPath();
    ctx.arc(25, -5, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(25.6, -5.4, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    const flap = Math.sin(state.time * 10) * 0.35;
    const wingGrad = ctx.createLinearGradient(-10, -30, 20, 0);
    wingGrad.addColorStop(0, flash ? "rgba(250,245,255,0.9)" : "rgba(126, 34, 206, 0.95)");
    wingGrad.addColorStop(1, flash ? "rgba(233,213,255,0.85)" : "rgba(168, 85, 247, 0.85)");
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(-10, -30 - flap * 22, 18, -18 + flap * 8);
    ctx.quadraticCurveTo(4, -8, -4, -4);
    ctx.fill();
    ctx.strokeStyle = flash ? "#faf5ff" : "#581c87";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // Wing membrane lines
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(8, -20 + flap * 4);
    ctx.moveTo(0, -5);
    ctx.lineTo(14, -14 + flap * 3);
    ctx.stroke();

    // Tail with purple flame tip
    ctx.strokeStyle = flash ? "#e9d5ff" : "#7e22ce";
    ctx.lineWidth = 5.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-20, 2);
    ctx.quadraticCurveTo(-36, 10 + Math.sin(state.time * 6) * 6, -46, -4);
    ctx.stroke();

    ctx.fillStyle = "#c084fc";
    ctx.beginPath();
    ctx.moveTo(-44, -4);
    ctx.lineTo(-56, -10 + Math.sin(state.time * 14) * 3);
    ctx.lineTo(-52, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0abfc";
    ctx.beginPath();
    ctx.moveTo(-48, -4);
    ctx.lineTo(-54, -7);
    ctx.lineTo(-51, 1);
    ctx.closePath();
    ctx.fill();

    // Shield bubble
    if (state.shield > 0 && state.mode === "play") {
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.35 + Math.sin(state.time * 8) * 0.2})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 36 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Draw classic wide sombrero on top of an enemy body */
  function drawSombrero(cx, cy, scale = 1, fancy = false) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Brim
    ctx.fillStyle = "#c9a227";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a67c00";
    ctx.beginPath();
    ctx.ellipse(0, 1, 16, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crown
    ctx.fillStyle = "#e8b923";
    ctx.beginPath();
    ctx.ellipse(0, -6, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4a017";
    ctx.fillRect(-7, -10, 14, 6);

    // Decorative band
    ctx.fillStyle = fancy ? "#b91c1c" : "#166534";
    ctx.fillRect(-7, -5, 14, 3);
    if (fancy) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-2, -5, 4, 3);
    }

    // Little ball on top
    ctx.fillStyle = fancy ? "#dc2626" : "#15803d";
    ctx.beginPath();
    ctx.arc(0, -12, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.type === "mariachi") {
      // Small purple-ish fiesta bat with sombrero
      ctx.fillStyle = "#5b3a7a";
      ctx.beginPath();
      ctx.ellipse(0, 4, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      const wing = Math.sin(state.time * 12 + e.t) * 7;
      ctx.fillStyle = "#7c4db0";
      ctx.beginPath();
      ctx.moveTo(-3, 4);
      ctx.quadraticCurveTo(-16, -8 - wing, -20, 6);
      ctx.quadraticCurveTo(-10, 8, -3, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(3, 4);
      ctx.quadraticCurveTo(16, -8 - wing, 20, 6);
      ctx.quadraticCurveTo(10, 8, 3, 4);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(-3, 3, 1.4, 0, Math.PI * 2);
      ctx.arc(3, 3, 1.4, 0, Math.PI * 2);
      ctx.fill();
      drawSombrero(0, -6, 0.75, false);
    } else if (e.type === "bandito") {
      // Armored bandit body + big hat
      ctx.fillStyle = "#4a3728";
      ctx.fillRect(-11, -2, 22, 20);
      ctx.fillStyle = "#c4a574";
      ctx.beginPath();
      ctx.arc(0, -8, 9, 0, Math.PI * 2);
      ctx.fill();
      // Mustache
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.quadraticCurveTo(0, -1, 6, -4);
      ctx.stroke();
      // Poncho
      ctx.fillStyle = "#b91c1c";
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(14, 0);
      ctx.lineTo(10, 18);
      ctx.lineTo(-10, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-2, 0, 4, 18);
      drawSombrero(0, -16, 1.05, true);
    } else if (e.type === "vaquero") {
      // Flying cowboy / vaquero dragon-hunter
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.ellipse(0, 4, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c4a574";
      ctx.beginPath();
      ctx.arc(14, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(10, -2, 10, 3); // mask line
      // Lasso whip
      ctx.strokeStyle = "#e7e5e4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-16, 8, 8, 0, Math.PI * 1.5);
      ctx.stroke();
      // Serape
      ctx.fillStyle = "#15803d";
      ctx.fillRect(-12, 2, 18, 6);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-12, 4, 18, 2);
      drawSombrero(12, -10, 0.95, false);
    } else {
      // El Jefe — big boss with mega sombrero
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.ellipse(0, 6, 28, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c4a574";
      ctx.beginPath();
      ctx.ellipse(18, 0, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Epic mustache
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, 4);
      ctx.quadraticCurveTo(18, 12, 28, 2);
      ctx.stroke();
      // Gold medals
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(-6, 8, 4, 0, Math.PI * 2);
      ctx.arc(2, 10, 3, 0, Math.PI * 2);
      ctx.fill();
      // Cape
      ctx.fillStyle = "#991b1b";
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-30, 10 + Math.sin(state.time * 5) * 4, -24, 28);
      ctx.lineTo(-4, 16);
      ctx.closePath();
      ctx.fill();
      drawSombrero(8, -18, 1.55, true);
      // HP bar
      const bw = 44;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-bw / 2, -36, bw, 5);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(-bw / 2, -36, bw * (e.hp / e.maxHp), 5);
    }

    if (e.type !== "el_jefe" && e.maxHp > 1) {
      const bw = e.w * 0.7;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(-bw / 2, -e.h * 0.55 - 4, bw, 4);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(-bw / 2, -e.h * 0.55 - 4, bw * (e.hp / e.maxHp), 4);
    }

    ctx.restore();
  }

  function drawBullet(b) {
    if (b.kind === "player") {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.4);
      g.addColorStop(0, "#faf5ff");
      g.addColorStop(0.35, b.color);
      g.addColorStop(1, "rgba(126, 34, 206, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y, b.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Golden chili / energy shot from sombrero foes
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff7ed";
      ctx.beginPath();
      ctx.arc(b.x + 1, b.y - 1, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickup(pk) {
    const pulse = 1 + Math.sin(pk.t * 6) * 0.12;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, pk.r * 2);
    g.addColorStop(0, pk.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, pk.r * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(15, 10, 25, 0.75)";
    ctx.beginPath();
    ctx.arc(0, 0, pk.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pk.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = pk.color;
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icon = { shield: "🛡", rapid: "⚡", multi: "✦", heal: "♥" }[pk.type] || "?";
    ctx.fillText(icon, 0, 1);

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    for (const f of floatTexts) {
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawFrame() {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    paintBackground();

    if (state.mode === "play" || state.mode === "pause" || state.mode === "gameover") {
      for (const b of bullets) drawBullet(b);
      for (const e of enemies) drawEnemy(e);
      for (const pk of pickups) drawPickup(pk);

      const blink = state.invuln > 0 && Math.floor(state.invuln * 16) % 2 === 0;
      if (!blink) drawDragon(player.x, player.y, state.invuln > 0);

      drawParticles();
      drawFloatTexts();

      if (state.mode === "play" && state.enemiesThisWave === 0 && state.spawnTimer > 0.5) {
        ctx.fillStyle = "rgba(216, 180, 254, 0.95)";
        ctx.font = "bold 28px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Wave ${state.wave}`, W / 2, 64);
      }
    }

    // Menu idle dragon
    if (state.mode === "menu") {
      drawDragon(W * 0.5, H * 0.68, false);
      // Decorative tiny sombrero foe
      ctx.save();
      ctx.globalAlpha = 0.85;
      drawEnemy({
        x: W * 0.72,
        y: H * 0.55,
        w: 36,
        h: 32,
        type: "mariachi",
        t: state.time,
        hp: 1,
        maxHp: 1,
      });
      ctx.restore();
    }

    ctx.restore();
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    updateStars(dt);
    if (state.mode !== "play") state.time += dt * 0.5;
    if (state.mode === "play") update(dt);
    drawFrame();
    requestAnimationFrame(frame);
  }

  // ---------- Input ----------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === " " || k.startsWith("arrow")) e.preventDefault();

    if (k === "m") {
      audio.enabled = !audio.enabled;
      setSoundButton();
      sfx.ui();
    }

    if (k === "p" && state.mode === "play") {
      state.mode = "pause";
      showOverlay("Paused", "The purple skies can wait.<br/>Press P or Continue.", "Continue", "⏸🟣");
      sfx.ui();
    } else if (k === "p" && state.mode === "pause") {
      state.mode = "play";
      hideMenus();
      sfx.ui();
    }

    if (k === "r" && state.mode === "gameover") resetGame();
    if (k === "enter" && state.mode === "menu") resetGame();
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key.toLowerCase());
  });

  canvas.addEventListener("mousedown", () => {
    mouseDown = true;
    if (state.mode === "play") shoot();
  });
  window.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  let touchId = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      touchId = t.identifier;
      mouseDown = true;
      if (state.mode !== "play") return;
      const rect = canvas.getBoundingClientRect();
      player.x = clamp((t.clientX - rect.left) * (W / rect.width), 30, W * 0.55);
      player.y = clamp((t.clientY - rect.top) * (H / rect.height), 30, H - 40);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        const rect = canvas.getBoundingClientRect();
        player.x = clamp((t.clientX - rect.left) * (W / rect.width), 30, W * 0.55);
        player.y = clamp((t.clientY - rect.top) * (H / rect.height), 30, H - 40);
      }
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", () => {
    mouseDown = false;
    touchId = null;
  });

  // Menu buttons
  btnPlay.addEventListener("click", () => resetGame());
  btnHowto.addEventListener("click", () => {
    howto.classList.toggle("hidden");
    sfx.ui();
  });
  btnSound.addEventListener("click", () => {
    ensureAudio();
    audio.enabled = !audio.enabled;
    setSoundButton();
    if (audio.enabled) sfx.ui();
  });

  overlayBtn.addEventListener("click", () => {
    if (state.mode === "pause") {
      state.mode = "play";
      hideMenus();
      sfx.ui();
    } else if (state.mode === "gameover") {
      resetGame();
    }
  });

  overlayMenu.addEventListener("click", () => {
    sfx.ui();
    showMenu();
  });

  // Boot
  bestEl.textContent = String(state.best);
  setSoundButton();
  seedBackground();
  updateHud();
  showMenu();
  requestAnimationFrame(frame);
})();
