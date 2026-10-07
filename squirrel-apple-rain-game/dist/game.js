(() => {
  "use strict";

  const arena = document.querySelector("#arena");
  const player = document.querySelector("#player");
  const scoreEl = document.querySelector("#score");
  const levelEl = document.querySelector("#level");
  const livesEl = document.querySelector("#lives");
  const hearts = [...document.querySelectorAll(".heart")];
  const startOverlay = document.querySelector("#startOverlay");
  const gameOverOverlay = document.querySelector("#gameOverOverlay");
  const pauseBadge = document.querySelector("#pauseBadge");
  const startBtn = document.querySelector("#startBtn");
  const restartBtn = document.querySelector("#restartBtn");
  const soundBtn = document.querySelector("#soundBtn");
  const finalScore = document.querySelector("#finalScore");
  const finalMessage = document.querySelector("#finalMessage");
  const feedback = document.querySelector("#feedback");

  const keys = new Set();
  const state = {
    phase: "idle",
    score: 0,
    lives: 3,
    level: 1,
    playerX: .5,
    items: [],
    spawnTimer: 0,
    lastTime: 0,
    paused: false,
    sound: true,
    raf: 0,
  };

  let audioContext;
  const getMetrics = () => ({ width: arena.clientWidth, height: arena.clientHeight, playerWidth: player.offsetWidth });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function tone(frequency, duration, type = "sine", volume = .055) {
    if (!state.sound) return;
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    levelEl.textContent = state.level;
    hearts.forEach((heart, index) => heart.classList.toggle("lost", index >= state.lives));
    livesEl.setAttribute("aria-label", `剩餘 ${state.lives} 顆心`);
  }

  function announce(text, kind = "good") {
    feedback.textContent = text;
    feedback.style.color = kind === "good" ? "#fff7a6" : "#fff";
    feedback.classList.remove("show");
    void feedback.offsetWidth;
    feedback.classList.add("show");
  }

  function clearItems() {
    state.items.forEach(item => item.el.remove());
    state.items.length = 0;
  }

  function resetState() {
    cancelAnimationFrame(state.raf);
    clearItems();
    keys.clear();
    Object.assign(state, { phase: "playing", score: 0, lives: 3, level: 1, playerX: .5, spawnTimer: 350, lastTime: performance.now(), paused: false });
    player.style.left = "50%";
    player.classList.remove("hurt", "running");
    startOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    pauseBadge.classList.add("hidden");
    updateHud();
    arena.focus({ preventScroll: true });
    tone(523, .09, "triangle");
    setTimeout(() => tone(659, .12, "triangle"), 80);
    state.raf = requestAnimationFrame(loop);
  }

  function spawnItem() {
    const isChestnut = Math.random() < Math.min(.20 + state.level * .008, .28);
    const el = document.createElement("div");
    el.className = `falling-item ${isChestnut ? "chestnut" : "apple"}`;
    el.setAttribute("aria-hidden", "true");
    arena.appendChild(el);
    const size = el.offsetWidth;
    const x = size + Math.random() * Math.max(1, arena.clientWidth - size * 2);
    const baseSpeed = 150 + Math.min(state.level - 1, 8) * 19;
    const item = { el, type: isChestnut ? "chestnut" : "apple", x, y: -size, size, speed: baseSpeed + Math.random() * 38, rotation: Math.random() * 360, spin: (Math.random() - .5) * 100 };
    state.items.push(item);
  }

  function loseLife(reason) {
    if (state.phase !== "playing") return;
    state.lives = Math.max(0, state.lives - 1);
    updateHud();
    player.classList.remove("hurt");
    void player.offsetWidth;
    player.classList.add("hurt");
    announce(reason, "bad");
    tone(155, .28, "sawtooth", .04);
    if (state.lives === 0) endGame();
  }

  function catchApple() {
    state.score += 1;
    state.level = Math.min(9, Math.floor(state.score / 5) + 1);
    updateHud();
    announce("+1");
    tone(720, .1, "sine");
  }

  function endGame() {
    if (state.phase === "gameOver") return;
    state.phase = "gameOver";
    keys.clear();
    player.classList.remove("running");
    clearItems();
    finalScore.textContent = state.score;
    finalMessage.textContent = state.score >= 20 ? "超厲害！松鼠都跟不上你了！" : state.score >= 10 ? "好身手！再來一籃會更高分。" : "再試一次，創下新紀錄吧！";
    gameOverOverlay.classList.remove("hidden");
    tone(330, .18, "triangle");
    setTimeout(() => tone(247, .32, "triangle"), 150);
    restartBtn.focus();
  }

  function loop(now) {
    if (state.phase !== "playing") return;
    const dt = Math.min((now - state.lastTime) / 1000, .034);
    state.lastTime = now;
    if (!state.paused) update(dt);
    state.raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    const metrics = getMetrics();
    const direction = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    const half = metrics.playerWidth / metrics.width / 2;
    state.playerX = clamp(state.playerX + direction * 0.62 * dt, half, 1 - half);
    player.style.left = `${state.playerX * 100}%`;
    player.classList.toggle("running", direction !== 0);

    state.spawnTimer -= dt * 1000;
    if (state.spawnTimer <= 0) {
      spawnItem();
      const interval = Math.max(430, 990 - (state.level - 1) * 68);
      state.spawnTimer = interval * (.82 + Math.random() * .36);
    }

    const playerRect = player.getBoundingClientRect();
    const basket = { left: playerRect.left + playerRect.width * .22, right: playerRect.right - playerRect.width * .22, top: playerRect.top + playerRect.height * .34, bottom: playerRect.top + playerRect.height * .63 };

    for (let i = state.items.length - 1; i >= 0; i--) {
      const item = state.items[i];
      item.y += item.speed * dt;
      item.rotation += item.spin * dt;
      item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.rotation}deg)`;
      const rect = item.el.getBoundingClientRect();
      const caught = rect.right > basket.left && rect.left < basket.right && rect.bottom > basket.top && rect.top < basket.bottom;
      if (caught) {
        item.el.remove();
        state.items.splice(i, 1);
        if (item.type === "apple") catchApple(); else loseLife("刺到啦！");
        continue;
      }
      if (item.y > metrics.height + item.size) {
        item.el.remove();
        state.items.splice(i, 1);
        if (item.type === "apple") loseLife("漏接了！");
      }
    }
  }

  const controlCodes = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD"]);
  window.addEventListener("keydown", event => {
    if (!controlCodes.has(event.code)) return;
    event.preventDefault();
    if (state.phase === "playing" && !state.paused) keys.add(event.code);
  }, { passive: false });
  window.addEventListener("keyup", event => {
    if (controlCodes.has(event.code)) {
      event.preventDefault();
      keys.delete(event.code);
    }
  }, { passive: false });

  function setPaused(paused) {
    if (state.phase !== "playing") return;
    state.paused = paused;
    keys.clear();
    player.classList.remove("running");
    pauseBadge.classList.toggle("hidden", !paused);
    state.lastTime = performance.now();
  }
  document.addEventListener("visibilitychange", () => setPaused(document.hidden));
  window.addEventListener("blur", () => setPaused(true));
  window.addEventListener("focus", () => setPaused(false));

  startBtn.addEventListener("click", resetState);
  restartBtn.addEventListener("click", resetState);
  soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    soundBtn.setAttribute("aria-pressed", String(state.sound));
    soundBtn.setAttribute("aria-label", state.sound ? "關閉音效" : "開啟音效");
    soundBtn.innerHTML = `<span aria-hidden="true">${state.sound ? "♫" : "♪"}</span> 音效${state.sound ? "開" : "關"}`;
    if (state.sound) tone(640, .08, "sine");
  });

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const registration = tool => Promise.resolve(context.registerTool(tool)).catch(() => {});
    registration({
      name: "start_or_restart_game",
      title: "開始或重新開始遊戲",
      description: "開始一局全新的松鼠蘋果雨遊戲，並將分數、生命和難度重設。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => { resetState(); return { phase: state.phase, score: state.score, lives: state.lives }; }
    });
    registration({
      name: "move_basket",
      title: "移動籃子",
      description: "將遊戲中的籃子向左或向右移動一小段。",
      inputSchema: { type: "object", properties: { direction: { type: "string", enum: ["left", "right"] } }, required: ["direction"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: input => {
        if (!input || !["left", "right"].includes(input.direction)) throw new Error("direction 必須是 left 或 right");
        if (state.phase !== "playing") throw new Error("遊戲尚未開始");
        state.playerX = clamp(state.playerX + (input.direction === "left" ? -.1 : .1), .08, .92);
        player.style.left = `${state.playerX * 100}%`;
        return { playerPosition: Number(state.playerX.toFixed(2)), direction: input.direction };
      }
    });
  }

  updateHud();
  registerWebMcpTools();
})();
