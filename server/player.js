class Player {
  constructor({ id, x, y, color }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.color = color;
    this.alive = true;
    this.score = 0;

    this.dir = { x: 1, y: 0 };
    this.nextDir = { x: 1, y: 0 };
    this.seq = 0;
    this.lastInputSeq = -1;
    this.kills = 0;
    this.reconnectToken = null;
    this.disconnected = false;
    this.disconnectAt = 0;
    this.reconnectExpiresAt = 0;

    this.hasTrail = false;
    this.trailCells = [];
  }

  setDirection(dir) {
    if (!dir) return;
    const { x, y } = dir;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (Math.abs(x) + Math.abs(y) !== 1) return;

    if (x === -this.dir.x && y === -this.dir.y) return;

    this.nextDir = { x, y };
  }

  step() {
    this.dir = this.nextDir;
    this.x += this.dir.x;
    this.y += this.dir.y;
  }
}

module.exports = { Player };
