class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.colorById = new Map();
    this.lastState = null;
    this.clientId = null;
  }

  setClientId(id) {
    this.clientId = id;
  }

  updateColors(players) {
    for (const p of players) {
      this.colorById.set(p.id, p.color);
    }
  }

  render(state) {
    if (!state) return;
    this.lastState = state;
    this.updateColors(state.players);

    const { ctx } = this;
    const { width, height, cellSize } = state;
    const canvasWidth = width * cellSize;
    const canvasHeight = height * cellSize;
    if (this.canvas.width !== canvasWidth) this.canvas.width = canvasWidth;
    if (this.canvas.height !== canvasHeight) this.canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const territory = state.territory;
    for (let i = 0; i < territory.length; i++) {
      const owner = territory[i];
      if (owner === 0) continue;
      const color = this.colorById.get(owner) || "#2a2f3a";
      const x = (i % width) * cellSize;
      const y = Math.floor(i / width) * cellSize;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellSize, cellSize);
    }

    for (const t of state.trails) {
      const color = this.colorById.get(t.owner) || "#ffffff";
      ctx.fillStyle = color;
      ctx.fillRect(t.x * cellSize, t.y * cellSize, cellSize, cellSize);
    }
    if (state.localTrail && state.localTrail.length) {
      for (const t of state.localTrail) {
        const color = this.colorById.get(t.owner) || "#ffffff";
        ctx.fillStyle = color;
        ctx.fillRect(t.x * cellSize, t.y * cellSize, cellSize, cellSize);
      }
    }

    for (const p of state.players) {
      const x = p.x * cellSize;
      const y = p.y * cellSize;
      ctx.fillStyle = p.alive ? p.color : "#555";
      ctx.fillRect(x, y, cellSize, cellSize);

      if (p.id === this.clientId) {
        ctx.save();
        ctx.lineWidth = Math.max(2, Math.floor(cellSize / 6));
        ctx.strokeStyle = "#ffffff";
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 6;
        const inset = Math.max(1, Math.floor(ctx.lineWidth / 2));
        ctx.strokeRect(
          x + inset,
          y + inset,
          cellSize - inset * 2,
          cellSize - inset * 2
        );
        ctx.restore();
      }
    }
  }
}

window.Renderer = Renderer;
