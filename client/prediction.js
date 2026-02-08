class Prediction {
  constructor() {
    this.pending = [];
    this.serverBuffer = [];
    this.localId = null;
    this.localSim = null;
    this.localHistory = [];
    this.lastAckSeq = -1;
    this.lastServerTick = 0;
    this.lastServerTimestamp = 0;
    this.serverTickAt = 0;
    this.serverTickTime = 0;
    this.simTick = 0;
    this.interpDelayMs = 100;
    this.tickRate = 20;
    this.tickMs = 1000 / this.tickRate;
    this.localLeadTicks = 0;
    this.localTrail = new Set();
    this.lastSimTime = performance.now();
    this.accumulator = 0;
    this.clientTick = 0;
  }

  reset() {
    this.pending = [];
    this.serverBuffer = [];
    this.localSim = null;
    this.localHistory = [];
    this.lastAckSeq = -1;
    this.lastServerTick = 0;
    this.lastServerTimestamp = 0;
    this.serverTickAt = 0;
    this.serverTickTime = 0;
    this.simTick = 0;
    this.localTrail = new Set();
    this.accumulator = 0;
    this.clientTick = 0;
    this.lastSimTime = performance.now();
  }

  setLocalPlayerId(id) {
    this.localId = id;
  }

  addInput(input) {
    const now = performance.now();
    const entry = {
      ...input,
      clientTime: now,
      clientTick: this.clientTick + 1,
    };
    this.pending.push(entry);
    if (this.localSim && input.direction) {
      this.localSim.dir = { ...input.direction };
    }
  }

  handleState(state) {
    if (!state) return;
    const now = performance.now();
    state._receivedAt = now;
    state._tick = state.serverTick ?? state.tick ?? 0;
    this.serverBuffer.push(state);
    this.serverBuffer.sort((a, b) => a._tick - b._tick);
    if (this.serverBuffer.length > 60) {
      this.serverBuffer.splice(0, this.serverBuffer.length - 60);
    }

    this.lastServerTick = state._tick;
    this.lastServerTimestamp = state.serverTimestamp ?? 0;
    if (this.lastServerTick >= this.serverTickAt) {
      this.serverTickAt = this.lastServerTick;
      this.serverTickTime = now;
    }

    if (typeof state.yourAckSeq === "number") {
      this.lastAckSeq = state.yourAckSeq;
      this.pending = this.pending.filter((input) => input.seq > this.lastAckSeq);
    }

    if (this.localId && Array.isArray(state.players)) {
      const serverPlayer = state.players.find((p) => p.id === this.localId);
      if (serverPlayer) {
        this.reconcile(serverPlayer);
      }
    }
  }

  reconcile(serverPlayer) {
    if (!this.localSim) {
      this.localSim = {
        x: serverPlayer.x,
        y: serverPlayer.y,
        dir: serverPlayer.dir ? { ...serverPlayer.dir } : { x: 1, y: 0 },
      };
    } else {
      this.localSim.x = serverPlayer.x;
      this.localSim.y = serverPlayer.y;
      if (serverPlayer.dir) {
        this.localSim.dir = { ...serverPlayer.dir };
      }
    }

    let simTick = Math.max(this.lastServerTick, 0);
    this.localHistory = [];
    this.recordLocal(simTick);
    const pending = this.pending.slice().sort((a, b) => a.clientTick - b.clientTick);
    let idx = 0;

    while (simTick < this.clientTick) {
      while (idx < pending.length && pending[idx].clientTick === simTick) {
        if (pending[idx].direction) {
          this.localSim.dir = { ...pending[idx].direction };
        }
        idx += 1;
      }
      this.stepLocal();
      simTick += 1;
      this.recordLocal(simTick);
    }
    this.simTick = this.clientTick;
  }

  updateSimulation(now) {
    if (!this.serverTickTime) {
      const dt = now - this.lastSimTime;
      this.lastSimTime = now;
      this.accumulator += dt;

      while (this.accumulator >= this.tickMs) {
        this.accumulator -= this.tickMs;
        this.clientTick += 1;
        if (this.localSim) {
          this.stepLocal();
          this.recordLocal(this.clientTick);
        }
      }
      return;
    }

    const elapsed = now - this.serverTickTime;
    const targetTick = this.serverTickAt + Math.floor(elapsed / this.tickMs);
    if (targetTick > this.clientTick) {
      this.clientTick = targetTick;
    }
    while (this.simTick < this.clientTick) {
      if (this.localSim) {
        this.stepLocal();
        this.recordLocal(this.simTick + 1);
      }
      this.simTick += 1;
    }
  }

  interpolateState(now) {
    if (this.serverBuffer.length === 0) return null;

    const latest = this.serverBuffer[this.serverBuffer.length - 1];
    const delayTicks = Math.max(1, Math.round(this.interpDelayMs / this.tickMs));
    const targetTick = Math.max(0, latest._tick - delayTicks);

    let older = null;
    let newer = null;
    for (const state of this.serverBuffer) {
      if (state._tick <= targetTick) {
        older = state;
      }
      if (state._tick >= targetTick) {
        newer = state;
        break;
      }
    }

    if (!older) older = this.serverBuffer[0];
    if (!newer) newer = this.serverBuffer[this.serverBuffer.length - 1];
    if (older === newer || newer._tick === older._tick) return older;

    const span = newer._tick - older._tick;
    const t = span > 0 ? (targetTick - older._tick) / span : 0;

    const prevById = new Map();
    for (const p of older.players) {
      prevById.set(p.id, p);
    }

    const players = newer.players.map((p) => {
      const prev = prevById.get(p.id);
      if (!prev || !p.alive) return { ...p };
      return {
        ...p,
        x: prev.x + (p.x - prev.x) * t,
        y: prev.y + (p.y - prev.y) * t,
      };
    });

    return {
      ...newer,
      players,
      _renderTick: targetTick,
    };
  }

  getRenderState() {
    const now = performance.now();
    this.updateSimulation(now);
    const base = this.interpolateState(now);
    if (!base) return null;

    if (this.localId && this.localSim && base.phase === "running") {
      const renderTick =
        (base._renderTick ?? base._tick ?? this.clientTick) + this.localLeadTicks;
      const localAt = this.getLocalAtTick(renderTick);
      const players = base.players.map((p) => {
        if (p.id !== this.localId) return p;
        if (localAt) {
          return {
            ...p,
            x: localAt.x,
            y: localAt.y,
          };
        }
        return {
          ...p,
          x: this.localSim.x,
          y: this.localSim.y,
        };
      });
      const localTrail = this.buildLocalTrail(base, localAt || this.localSim);
      return {
        ...base,
        players,
        localTrail,
      };
    }

    return base;
  }

  stepLocal() {
    if (!this.localSim) return;
    this.localSim.x += this.localSim.dir.x;
    this.localSim.y += this.localSim.dir.y;
  }

  recordLocal(tick) {
    if (!this.localSim) return;
    this.localHistory.push({
      tick,
      x: this.localSim.x,
      y: this.localSim.y,
    });
    if (this.localHistory.length > 200) {
      this.localHistory.splice(0, this.localHistory.length - 200);
    }
  }

  getLocalAtTick(tick) {
    if (this.localHistory.length === 0) return null;
    for (let i = this.localHistory.length - 1; i >= 0; i -= 1) {
      const entry = this.localHistory[i];
      if (entry.tick <= tick) return entry;
    }
    return this.localHistory[0];
  }

  buildLocalTrail(state, localPos) {
    if (!state || !localPos || !state.territory) return [];
    const localPlayer = state.players?.find((p) => p.id === this.localId);
    if (!localPlayer || !localPlayer.alive) {
      this.localTrail.clear();
      return [];
    }

    const width = state.width;
    const height = state.height;
    const x = Math.round(localPos.x);
    const y = Math.round(localPos.y);
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return [];
    }

    const idx = y * width + x;
    const owned = state.territory[idx] === this.localId;
    if (owned) {
      if (this.localTrail.size > 0) this.localTrail.clear();
    } else {
      this.localTrail.add(idx);
    }

    const localTrail = [];
    for (const cellIdx of this.localTrail) {
      const cx = cellIdx % width;
      const cy = Math.floor(cellIdx / width);
      localTrail.push({ x: cx, y: cy, owner: this.localId });
    }
    return localTrail;
  }
}

window.Prediction = Prediction;
