const { randomUUID } = require("crypto");
const { Player } = require("./player");

class Match {
  constructor({ width, height, cellSize, maxPlayers, durationMs }) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.maxPlayers = maxPlayers;
    this.durationMs = durationMs;

    this.players = new Map();
    this.nextPlayerId = 1;
    this.tick = 0;
    this.startedAt = 0;
    this.over = false;
    this.phase = "lobby";
    this.roomId = `room-${Math.floor(Math.random() * 1e6)}`;
    this.joinedAt = Date.now();
    this.matchStartDeadlineMs = 15 * 1000;
    this.endDelayMs = 5 * 1000;
    this.endedAt = 0;
    this.graceMs = 10 * 1000;
    this.pendingReconnects = new Map();
    this.endReason = null;
    this.lastResults = null;
    this.justEnded = false;
    this.startedPlayerCount = 0;

    this.ownerGrid = new Uint16Array(width * height);
    this.trailGrid = new Uint16Array(width * height);

    this.colors = [
      "#ff6b6b",
      "#4dabf7",
      "#69db7c",
      "#ffd43b",
      "#845ef7",
    ];
  }

  idx(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  addPlayer(opts = {}) {
    if (this.players.size >= this.maxPlayers) return null;

    const id = opts.id || this.nextPlayerId++;
    if (id >= this.nextPlayerId) {
      this.nextPlayerId = id + 1;
    }
    const color = this.colors[(id - 1) % this.colors.length];
    const spawn = this.findSpawn();
    if (!spawn) return null;

    const player = new Player({ id, x: spawn.x, y: spawn.y, color });
    player.reconnectToken = opts.reconnectToken || randomUUID();
    player.disconnected = false;
    player.disconnectAt = 0;
    player.reconnectExpiresAt = 0;
    this.players.set(id, player);

    this.seedTerritory(player, spawn.x, spawn.y);
    if (this.phase === "lobby" && this.players.size === 1) {
      this.joinedAt = Date.now();
    }
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    this.clearTrail(player);
    this.clearTerritory(player);
    this.pendingReconnects.delete(player.reconnectToken);
    this.players.delete(id);
    if (this.players.size === 0) {
      this.joinedAt = Date.now();
    }
  }

  findSpawn() {
    for (let attempts = 0; attempts < 200; attempts++) {
      const x = 2 + Math.floor(Math.random() * (this.width - 4));
      const y = 2 + Math.floor(Math.random() * (this.height - 4));
      const idx = this.idx(x, y);
      if (this.ownerGrid[idx] === 0 && this.trailGrid[idx] === 0) {
        return { x, y };
      }
    }
    return null;
  }

  seedTerritory(player, x, y) {
    const r = 2;
    for (let yy = y - r; yy <= y + r; yy++) {
      for (let xx = x - r; xx <= x + r; xx++) {
        if (!this.inBounds(xx, yy)) continue;
        this.ownerGrid[this.idx(xx, yy)] = player.id;
      }
    }
  }

  handleInput(id, msg) {
    const player = this.players.get(id);
    if (!player || !player.alive) return;
    if (!msg || typeof msg.seq !== "number") return;
    const seq = msg.seq >>> 0;
    if (seq <= player.lastInputSeq) return;
    player.lastInputSeq = seq;
    player.seq = seq;
    player.setDirection(msg.direction);
  }

  update(now = Date.now()) {
    this.pruneReconnects(now);

    if (this.phase === "lobby") {
      const shouldStart =
        this.players.size > 0 &&
        (this.players.size >= this.maxPlayers ||
          now - this.joinedAt >= this.matchStartDeadlineMs);
      if (shouldStart) {
        this.startMatch(now);
      }
      this.tick += 1;
      return;
    }

    if (this.phase === "ended") {
      if (now - this.endedAt >= this.endDelayMs) {
        this.resetToLobby(now);
      }
      this.tick += 1;
      return;
    }

    if (this.phase !== "running") {
      this.tick += 1;
      return;
    }

    const elapsed = now - this.startedAt;
    if (elapsed >= this.durationMs) {
      this.endMatch("time", now);
      return;
    }

    for (const player of this.players.values()) {
      if (!player.alive) continue;

      player.step();
      if (!this.inBounds(player.x, player.y)) {
        this.kill(player);
        continue;
      }

      const cellIdx = this.idx(player.x, player.y);

      if (this.trailGrid[cellIdx] !== 0) {
        const owner = this.trailGrid[cellIdx];
        if (owner && owner !== player.id) {
          const killer = this.players.get(owner);
          if (killer) killer.kills += 1;
        }
        this.kill(player);
        continue;
      }

      if (this.ownerGrid[cellIdx] === player.id) {
        if (player.hasTrail) {
          this.closeTrail(player);
        }
        player.hasTrail = false;
      } else {
        player.hasTrail = true;
        this.trailGrid[cellIdx] = player.id;
        player.trailCells.push(cellIdx);
      }
    }

    this.recalculateScores();
    const reason = this.checkWinConditions();
    if (reason) {
      this.endMatch(reason, now);
      return;
    }
    this.tick += 1;
  }

  kill(player) {
    player.alive = false;
    player.hasTrail = false;
    this.clearTrail(player);
  }

  clearTrail(player) {
    for (const idx of player.trailCells) {
      if (this.trailGrid[idx] === player.id) {
        this.trailGrid[idx] = 0;
      }
    }
    player.trailCells = [];
  }

  clearTerritory(player) {
    for (let i = 0; i < this.ownerGrid.length; i++) {
      if (this.ownerGrid[i] === player.id) {
        this.ownerGrid[i] = 0;
      }
    }
  }

  resetWorld() {
    this.ownerGrid.fill(0);
    this.trailGrid.fill(0);
  }

  startMatch(now) {
    this.resetWorld();
    this.startedAt = now;
    this.over = false;
    this.phase = "running";
    this.endReason = null;
    this.lastResults = null;
    this.justEnded = false;
    this.startedPlayerCount = this.players.size;

    for (const player of this.players.values()) {
      let spawn = { x: player.x, y: player.y };
      if (!this.inBounds(spawn.x, spawn.y)) {
        spawn = this.findSpawn();
      }
      if (!spawn) {
        player.alive = false;
        continue;
      }
      player.x = spawn.x;
      player.y = spawn.y;
      player.dir = { x: 1, y: 0 };
      player.nextDir = { x: 1, y: 0 };
      player.alive = true;
      player.score = 0;
      player.kills = 0;
      player.hasTrail = false;
      player.trailCells = [];
      player.lastInputSeq = -1;
      player.seq = 0;
      this.seedTerritory(player, spawn.x, spawn.y);
    }
  }

  endMatch(reason, now) {
    this.over = true;
    this.phase = "ended";
    this.endedAt = now;
    this.endReason = reason;
    this.lastResults = this.buildResults();
    this.justEnded = true;
  }

  resetToLobby(now) {
    this.phase = "lobby";
    this.over = false;
    this.startedAt = 0;
    this.endedAt = 0;
    this.endReason = null;
    this.justEnded = false;
    this.startedPlayerCount = 0;
    this.joinedAt = now;
    this.resetWorld();
  }

  buildResults() {
    const results = Array.from(this.players.values())
      .map((player) => ({
        playerId: player.id,
        score: player.score,
        kills: player.kills,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.kills - a.kills;
      })
      .map((entry, index) => ({
        place: index + 1,
        ...entry,
      }));
    return results;
  }

  markDisconnected(id, now = Date.now()) {
    const player = this.players.get(id);
    if (!player) return;
    player.disconnected = true;
    player.disconnectAt = now;
    player.reconnectExpiresAt = now + this.graceMs;
    this.pendingReconnects.set(player.reconnectToken, player.id);
  }

  tryReconnect(token, now = Date.now()) {
    const id = this.pendingReconnects.get(token);
    if (!id) return null;
    const player = this.players.get(id);
    if (!player) {
      this.pendingReconnects.delete(token);
      return null;
    }
    if (now > player.reconnectExpiresAt) {
      this.pendingReconnects.delete(token);
      return null;
    }
    player.disconnected = false;
    player.disconnectAt = 0;
    player.reconnectExpiresAt = 0;
    this.pendingReconnects.delete(token);
    return player;
  }

  pruneReconnects(now = Date.now()) {
    for (const [token, id] of this.pendingReconnects.entries()) {
      const player = this.players.get(id);
      if (!player) {
        this.pendingReconnects.delete(token);
        continue;
      }
      if (now > player.reconnectExpiresAt) {
        this.pendingReconnects.delete(token);
        this.removePlayer(player.id);
      }
    }
  }

  closeTrail(player) {
    for (const idx of player.trailCells) {
      this.ownerGrid[idx] = player.id;
      this.trailGrid[idx] = 0;
    }

    const total = this.width * this.height;
    const blocked = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      if (this.ownerGrid[i] === player.id || this.trailGrid[i] === player.id) {
        blocked[i] = 1;
      }
    }

    const visited = new Uint8Array(total);
    const queue = [];

    const pushIf = (x, y) => {
      if (!this.inBounds(x, y)) return;
      const i = this.idx(x, y);
      if (blocked[i] || visited[i]) return;
      visited[i] = 1;
      queue.push({ x, y });
    };

    for (let x = 0; x < this.width; x++) {
      pushIf(x, 0);
      pushIf(x, this.height - 1);
    }
    for (let y = 0; y < this.height; y++) {
      pushIf(0, y);
      pushIf(this.width - 1, y);
    }

    while (queue.length) {
      const { x, y } = queue.pop();
      pushIf(x + 1, y);
      pushIf(x - 1, y);
      pushIf(x, y + 1);
      pushIf(x, y - 1);
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = this.idx(x, y);
        if (blocked[i]) continue;
        if (!visited[i]) {
          this.ownerGrid[i] = player.id;
        }
      }
    }

    player.trailCells = [];
  }

  recalculateScores() {
    for (const player of this.players.values()) {
      player.score = 0;
    }
    for (let i = 0; i < this.ownerGrid.length; i++) {
      const id = this.ownerGrid[i];
      if (id === 0) continue;
      const player = this.players.get(id);
      if (player) player.score += 1;
    }
  }

  checkWinConditions() {
    if (this.players.size === 0) return "empty";
    const total = this.width * this.height;
    let aliveCount = 0;

    for (const player of this.players.values()) {
      if (player.alive) {
        aliveCount += 1;
      }
      if (player.score / total >= 0.96) {
        return "territory";
      }
    }

    if (aliveCount <= 1 && this.startedPlayerCount > 1) {
      return "lastSurvivor";
    }

    return null;
  }

  buildState(forPlayerId = null, now = Date.now()) {
    const players = [];
    for (const player of this.players.values()) {
      players.push({
        id: player.id,
        x: player.x,
        y: player.y,
        dir: player.dir,
        alive: player.alive,
        color: player.color,
        score: player.score,
        kills: player.kills,
      });
    }

    const trails = [];
    for (let i = 0; i < this.trailGrid.length; i++) {
      const owner = this.trailGrid[i];
      if (owner === 0) continue;
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      trails.push({ x, y, owner });
    }

    const you = forPlayerId ? this.players.get(forPlayerId) : null;
    const timeLeftMs =
      this.phase === "running"
        ? Math.max(0, this.durationMs - (now - this.startedAt))
        : 0;
    const lobbyStartInMs =
      this.phase === "lobby"
        ? Math.max(0, this.matchStartDeadlineMs - (now - this.joinedAt))
        : 0;

    return {
      tick: this.tick,
      serverTick: this.tick,
      serverTimestamp: now,
      yourAckSeq: you ? you.lastInputSeq : -1,
      roomId: this.roomId,
      playerId: forPlayerId,
      phase: this.phase,
      over: this.over,
      endReason: this.endReason,
      timeLeftMs,
      lobbyStartInMs,
      playersInRoom: this.players.size,
      maxPlayers: this.maxPlayers,
      results: this.lastResults,
      players,
      trails,
      territory: Array.from(this.ownerGrid),
      width: this.width,
      height: this.height,
      cellSize: this.cellSize,
    };
  }
}

module.exports = { Match };
