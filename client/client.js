(() => {
  const canvas = document.getElementById("game");
  const hud = document.getElementById("hud");
  const renderer = new window.Renderer(canvas);
  const prediction = new window.Prediction();

  let ws;
  let clientId = null;
  let roomId = null;
  let seq = 0;
  let pingMs = null;
  let pingTimer = null;

  const directionByKey = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    KeyW: { x: 0, y: -1 },
    KeyS: { x: 0, y: 1 },
    KeyA: { x: -1, y: 0 },
    KeyD: { x: 1, y: 0 },
  };

  function getReconnectToken() {
    return localStorage.getItem("zonogReconnectToken");
  }

  function setReconnectToken(token) {
    if (!token) return;
    localStorage.setItem("zonogReconnectToken", token);
  }

  function connect() {
    ws = new WebSocket("ws://localhost:3001/");

    ws.addEventListener("open", () => {
      const reconnectToken = getReconnectToken();
      ws.send(
        JSON.stringify({
          type: "join",
          reconnectToken: reconnectToken || null,
        })
      );
      startPing();
    });

    ws.addEventListener("message", (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        return;
      }

      if (data.type === "init") {
        clientId = data.playerId ?? data.id;
        roomId = data.roomId || null;
        seq = 0;
        prediction.reset();
        prediction.setLocalPlayerId(clientId);
        renderer.setClientId(clientId);
        setReconnectToken(data.reconnectToken);
      }

      if (data.type === "state") {
        prediction.handleState(data);
      }

      if (data.type === "pong") {
        if (typeof data.clientTime === "number") {
          pingMs = Date.now() - data.clientTime;
        }
      }

    });

    ws.addEventListener("close", () => {
      stopPing();
      setTimeout(connect, 1000);
    });
  }

  function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const clientTime = Date.now();
      ws.send(JSON.stringify({ type: "ping", clientTime }));
    }, 1000);
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function sendDirection(dir) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (clientId == null) return;
    const msg = {
      type: "input",
      seq: seq++,
      direction: dir,
    };
    prediction.addInput(msg);
    ws.send(JSON.stringify(msg));
  }

  window.addEventListener("keydown", (e) => {
    const dir = directionByKey[e.code];
    if (!dir) return;
    e.preventDefault();
    sendDirection(dir);
  });

  function updateHud(state) {
    const local =
      state && Array.isArray(state.players)
        ? state.players.find((p) => p.id === clientId)
        : null;
    const pos = local ? `${local.x.toFixed(1)}, ${local.y.toFixed(1)}` : "-";
    const tick =
      prediction.lastServerTick ?? state?.serverTick ?? state?.tick ?? "-";
    const latency = pingMs != null ? `${Math.round(pingMs)}ms` : "-";
    const phase = state?.phase ? state.phase : "-";
    let timerLine = "";
    if (state?.phase === "lobby") {
      const startIn = Math.max(0, Math.ceil((state.lobbyStartInMs || 0) / 1000));
      const count = state.playersInRoom ?? "-";
      const max = state.maxPlayers ?? "-";
      timerLine = `\nLobby: starts in ${startIn}s (${count}/${max})`;
    } else if (state?.phase === "running") {
      const left = Math.max(0, Math.ceil((state.timeLeftMs || 0) / 1000));
      timerLine = `\nTime left: ${left}s`;
    }

    hud.textContent =
      `Room: ${roomId || "-"}` +
      `\nPlayer: ${clientId || "-"}` +
      `\nPing: ${latency}` +
      `\nPos: ${pos}` +
      `\nServerTick: ${tick}` +
      `\nPhase: ${phase}` +
      timerLine;
  }

  function loop() {
    const state = prediction.getRenderState();
    renderer.render(state);
    updateHud(state);
    requestAnimationFrame(loop);
  }

  connect();
  loop();
})();
