const uWS = require("uWebSockets.js");
const { Match } = require("./match");
const { MSG } = require("./protocol");

const TICK_RATE = 20;
const PORT = 3001;

const MATCH_CONFIG = {
  width: 200,
  height: 150,
  cellSize: 4,
  maxPlayers: 5,
  durationMs: 3 * 60 * 1000,
};

class RoomManager {
  constructor(matchConfig) {
    this.matchConfig = matchConfig;
    this.rooms = new Map();
  }

  createRoom() {
    const match = new Match(this.matchConfig);
    const room = {
      id: match.roomId,
      match,
      clients: new Set(),
      connections: new Map(),
    };
    this.rooms.set(room.id, room);
    return room;
  }

  getLobbyRoom() {
    for (const room of this.rooms.values()) {
      if (room.match.phase === "lobby" && room.match.players.size < room.match.maxPlayers) {
        return room;
      }
    }
    return null;
  }

  findReconnectRoom(token, now) {
    for (const room of this.rooms.values()) {
      const player = room.match.tryReconnect(token, now);
      if (player) {
        return { room, player };
      }
    }
    return null;
  }

  attach(ws, room, player, reconnected) {
    const existing = room.connections.get(player.id);
    if (existing && existing !== ws) {
      try {
        existing.close();
      } catch (err) {
      }
    }

    room.connections.set(player.id, ws);
    room.clients.add(ws);
    ws.roomId = room.id;
    ws.playerId = player.id;

    if (reconnected) {
      player.lastInputSeq = -1;
      player.seq = 0;
    }
  }

  join(ws, reconnectToken) {
    const now = Date.now();
    if (reconnectToken) {
      const found = this.findReconnectRoom(reconnectToken, now);
      if (found) {
        this.attach(ws, found.room, found.player, true);
        return { ...found, reconnected: true };
      }
    }

    let room = this.getLobbyRoom();
    if (!room) room = this.createRoom();

    let player = room.match.addPlayer();
    if (!player) {
      room = this.createRoom();
      player = room.match.addPlayer();
      if (!player) return null;
    }

    this.attach(ws, room, player, false);
    return { room, player, reconnected: false };
  }

  handleDisconnect(ws) {
    const room = this.rooms.get(ws.roomId);
    if (!room) return;

    room.clients.delete(ws);
    room.connections.delete(ws.playerId);

    const match = room.match;
    if (match.phase === "running") {
      match.markDisconnected(ws.playerId);
    } else {
      match.removePlayer(ws.playerId);
    }
  }

  tick() {
    const now = Date.now();

    for (const room of this.rooms.values()) {
      const match = room.match;
      match.update(now);

      if (match.justEnded) {
        const payload = JSON.stringify({
          type: MSG.RESULTS,
          roomId: match.roomId,
          endReason: match.endReason,
          results: match.lastResults,
        });
        for (const ws of room.clients) {
          ws.send(payload);
        }
        match.justEnded = false;
      }

      for (const ws of room.clients) {
        const state = match.buildState(ws.playerId, now);
        ws.send(JSON.stringify({ type: MSG.STATE, ...state }));
      }

      if (match.players.size === 0 && room.clients.size === 0 && match.phase === "lobby") {
        this.rooms.delete(room.id);
      }
    }
  }
}

const manager = new RoomManager(MATCH_CONFIG);
const app = uWS.App();

app.ws("/", {
  idleTimeout: 60,
  maxPayloadLength: 16 * 1024,
  open: (ws) => {
    ws.roomId = null;
    ws.playerId = null;
  },
  message: (ws, message, isBinary) => {
    if (isBinary) return;
    let data;
    try {
      data = JSON.parse(Buffer.from(message).toString("utf8"));
    } catch (err) {
      return;
    }

    if (data.type === MSG.JOIN) {
      if (ws.playerId) return;
      const joined = manager.join(ws, data.reconnectToken);
      if (!joined) {
        ws.close();
        return;
      }

      const init = {
        type: MSG.INIT,
        id: joined.player.id,
        playerId: joined.player.id,
        roomId: joined.room.id,
        width: joined.room.match.width,
        height: joined.room.match.height,
        cellSize: joined.room.match.cellSize,
        serverTick: joined.room.match.tick,
        serverTimestamp: Date.now(),
        reconnectToken: joined.player.reconnectToken,
        durationMs: joined.room.match.durationMs,
      };
      ws.send(JSON.stringify(init));
      return;
    }

    if (data.type === MSG.INPUT) {
      if (!ws.playerId) return;
      const room = manager.rooms.get(ws.roomId);
      if (!room) return;
      room.match.handleInput(ws.playerId, data);
      return;
    }

    if (data.type === MSG.PING) {
      ws.send(
        JSON.stringify({
          type: MSG.PONG,
          clientTime: data.clientTime,
          serverTimestamp: Date.now(),
        })
      );
    }
  },
  close: (ws) => {
    if (ws.playerId) {
      manager.handleDisconnect(ws);
    }
  },
});

app.listen(PORT, (token) => {
  if (token) {
    console.log(`uWebSockets server listening on ws://localhost:${PORT}`);
  } else {
    console.error(`Failed to listen on port ${PORT}`);
  }
});

setInterval(() => {
  manager.tick();
}, 1000 / TICK_RATE);
