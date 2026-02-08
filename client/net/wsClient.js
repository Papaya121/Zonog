class WSClient {
  constructor() {
    this.ws = null;
    this.handlers = [];
    this.isMock = false;
    this.mockInterval = null;
  }

  connect(url, opts = {}) {
    this.isMock = Boolean(opts.mock);
    if (this.isMock) {
      setTimeout(() => {
        this._emit({ type: "connected", playerId: 1 });
      }, 200);
      return;
    }

    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        return;
      }
      this._emit(data);
    });
  }

  send(msg) {
    if (this.isMock) {
      this._mockResponse(msg);
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  onMessage(cb) {
    this.handlers.push(cb);
  }

  _emit(msg) {
    for (const cb of this.handlers) cb(msg);
  }

  _mockResponse(msg) {
    if (msg.type === "join") {
      this._emit({ type: "connected", playerId: 1 });
    }
    if (msg.type === "chooseColor") {
      this._emit({ type: "queued", playersInQueue: 1 });
    }
    if (msg.type === "queue") {
      setTimeout(() => {
        this._emit({ type: "matchStart", durationSec: 180 });
        this._startMockMatch();
      }, 600);
    }
    if (msg.type === "respawn" && msg.action === "comeback") {
      this._emit({ type: "matchStart", durationSec: 180 });
      this._startMockMatch();
    }
  }

  _startMockMatch() {
    if (this.mockInterval) clearInterval(this.mockInterval);
    const mapWidth = 60;
    const mapHeight = 40;
    const territory = new Array(mapWidth * mapHeight).fill(0);
    let t = 0;
    const players = [
      { id: 1, x: 10, y: 10, color: "#4dabf7" },
      { id: 2, x: 40, y: 20, color: "#ff6b6b" },
      { id: 3, x: 20, y: 30, color: "#69db7c" },
    ];

    this.mockInterval = setInterval(() => {
      t += 1;
      players[0].x = 10 + Math.floor(Math.sin(t / 6) * 8);
      players[0].y = 10 + Math.floor(Math.cos(t / 6) * 6);
      players[1].x = 40 + Math.floor(Math.sin(t / 7) * 6);
      players[1].y = 20 + Math.floor(Math.cos(t / 7) * 5);
      players[2].x = 20 + Math.floor(Math.sin(t / 5) * 7);
      players[2].y = 30 + Math.floor(Math.cos(t / 5) * 6);

      const state = {
        type: "state",
        tick: t,
        players: players.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          alive: true,
          color: p.color,
          score: 100 + p.id * 10,
        })),
        yourId: 1,
        mapWidth,
        mapHeight,
        timerSec: Math.max(0, 180 - Math.floor(t / 5)),
        top3: [
          { name: "You", score: 12 },
          { name: "Bot A", score: 9 },
          { name: "Bot B", score: 7 },
        ],
        kills: 0,
        progress: 12,
        trails: [],
        territory,
        width: mapWidth,
        height: mapHeight,
        cellSize: 4,
      };

      this._emit(state);
    }, 200);

    setTimeout(() => {
      if (this.mockInterval) {
        clearInterval(this.mockInterval);
        this.mockInterval = null;
      }
      this._emit({
        type: "matchEnd",
        reason: "time",
        results: [
          { place: 1, name: "You", score: 32 },
          { place: 2, name: "Bot A", score: 28 },
          { place: 3, name: "Bot B", score: 21 },
        ],
      });
    }, 15000);
  }
}

window.WSClient = WSClient;
