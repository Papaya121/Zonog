class Hud {
  constructor(root, opts = {}) {
    this.root = root;
    this.totalCells = opts.totalCells || 1;
    this.el = document.createElement("div");
    this.el.className = "hud";

    this.timerEl = document.createElement("div");
    this.timerEl.className = "hud-timer";

    this.progressWrap = document.createElement("div");
    this.progressWrap.className = "hud-progress";
    this.progressBar = document.createElement("div");
    this.progressBar.className = "hud-progress-bar";
    this.progressWrap.appendChild(this.progressBar);

    this.killsEl = document.createElement("div");
    this.killsEl.className = "hud-kills";
    this.killsEl.textContent = "☠ 0";

    this.topList = document.createElement("div");
    this.topList.className = "hud-top";

    this.minimap = document.createElement("canvas");
    this.minimap.className = "hud-minimap";
    this.minimap.width = 120;
    this.minimap.height = 120;
    this.mmCtx = this.minimap.getContext("2d");

    this.el.appendChild(this.timerEl);
    this.el.appendChild(this.progressWrap);
    this.el.appendChild(this.killsEl);
    this.el.appendChild(this.minimap);
    this.el.appendChild(this.topList);

    this.root.innerHTML = "";
    this.root.appendChild(this.el);
  }

  update(state) {
    if (!state) return;

    const timerSec = state.timerSec ?? 0;
    const minutes = String(Math.floor(timerSec / 60)).padStart(1, "0");
    const seconds = String(timerSec % 60).padStart(2, "0");
    this.timerEl.textContent = `${minutes}:${seconds}`;

    const progress = Math.max(0, Math.min(100, state.progress ?? 0));
    this.progressBar.style.width = `${progress}%`;

    const kills = state.kills ?? 0;
    this.killsEl.textContent = `☠ ${kills}`;

    const top3 = state.top3 || [];
    this.topList.innerHTML = top3
      .map((p, i) => `${i + 1}. ${p.name} ${p.score}%`)
      .join("<br>");

    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mmCtx;
    ctx.clearRect(0, 0, this.minimap.width, this.minimap.height);
    ctx.fillStyle = "#0f141d";
    ctx.fillRect(0, 0, this.minimap.width, this.minimap.height);

    const w = state.mapWidth || 1;
    const h = state.mapHeight || 1;
    const scaleX = this.minimap.width / w;
    const scaleY = this.minimap.height / h;

    for (const p of state.players || []) {
      const x = p.x * scaleX;
      const y = p.y * scaleY;
      if (p.id === state.yourId) {
        ctx.fillStyle = p.color || "#fff";
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.lineTo(x - 4, y + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color || "#888";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  destroy() {
    this.root.innerHTML = "";
  }
}

window.Hud = Hud;
