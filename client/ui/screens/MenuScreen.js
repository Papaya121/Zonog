class MenuScreen {
  constructor(root, data) {
    this.root = root;
    this.onPlay = data?.onPlay;
    this.onBack = data?.onBack;
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "screen menu";

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = "Main Menu";

    const playBtn = document.createElement("button");
    playBtn.className = "btn primary";
    playBtn.textContent = "Play now";
    playBtn.addEventListener("click", () => {
      if (this.onPlay) this.onPlay();
    });

    const backBtn = document.createElement("button");
    backBtn.className = "btn";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", () => {
      if (this.onBack) this.onBack();
    });

    card.appendChild(title);
    card.appendChild(playBtn);
    card.appendChild(backBtn);
    wrap.appendChild(card);

    this.root.appendChild(wrap);
    this.el = wrap;
  }

  destroy() {
    if (this.el) this.el.remove();
  }
}

window.Screens = window.Screens || {};
window.Screens.MenuScreen = MenuScreen;
