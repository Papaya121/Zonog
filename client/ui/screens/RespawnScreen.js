class RespawnScreen {
  constructor(root, data) {
    this.root = root;
    this.timeLeft = data?.timeLeft ?? 5;
    this.onComeback = data?.onComeback;
    this.onQuit = data?.onQuit;
    this.interval = null;
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "screen respawn";

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = "You are out";

    this.timerEl = document.createElement("p");
    this.timerEl.textContent = `Respawn in ${this.timeLeft}s`;

    const comebackBtn = document.createElement("button");
    comebackBtn.className = "btn primary";
    comebackBtn.textContent = "Comeback";
    comebackBtn.addEventListener("click", () => {
      if (this.onComeback) this.onComeback();
    });

    const quitBtn = document.createElement("button");
    quitBtn.className = "btn";
    quitBtn.textContent = "Quit";
    quitBtn.addEventListener("click", () => {
      if (this.onQuit) this.onQuit();
    });

    card.appendChild(title);
    card.appendChild(this.timerEl);
    card.appendChild(comebackBtn);
    card.appendChild(quitBtn);
    wrap.appendChild(card);

    this.root.appendChild(wrap);
    this.el = wrap;

    this.interval = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      if (this.timerEl) this.timerEl.textContent = `Respawn in ${this.timeLeft}s`;
    }, 1000);
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    if (this.el) this.el.remove();
  }
}

window.Screens = window.Screens || {};
window.Screens.RespawnScreen = RespawnScreen;
