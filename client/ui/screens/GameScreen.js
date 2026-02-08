class GameScreen {
  constructor(root, data) {
    this.root = root;
    this.onQuit = data?.onQuit;
    this.timerSec = data?.timerSec ?? 180;
    this.interval = null;
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "screen game";

    const card = document.createElement("div");
    card.className = "card compact";

    const title = document.createElement("h2");
    title.textContent = "Match in progress";

    this.timerEl = document.createElement("p");
    this.timerEl.textContent = `Time left: ${this.timerSec}s`;

    const hint = document.createElement("p");
    hint.textContent = "Move: WASD / arrows";

    const quitBtn = document.createElement("button");
    quitBtn.className = "btn";
    quitBtn.textContent = "Quit";
    quitBtn.addEventListener("click", () => {
      if (this.onQuit) this.onQuit();
    });

    card.appendChild(title);
    card.appendChild(this.timerEl);
    card.appendChild(hint);
    card.appendChild(quitBtn);
    wrap.appendChild(card);

    this.root.appendChild(wrap);
    this.el = wrap;

    this.interval = setInterval(() => {
      this.timerSec = Math.max(0, this.timerSec - 1);
      if (this.timerEl) this.timerEl.textContent = `Time left: ${this.timerSec}s`;
    }, 1000);
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    if (this.el) this.el.remove();
  }
}

window.Screens = window.Screens || {};
window.Screens.GameScreen = GameScreen;
