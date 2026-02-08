class ColorScreen {
  constructor(root, data) {
    this.root = root;
    this.onChoose = data?.onChoose;
    this.colors = data?.colors || [
      { id: 0, name: "Coral", value: "#ff6b6b" },
      { id: 1, name: "Sky", value: "#4dabf7" },
      { id: 2, name: "Mint", value: "#69db7c" },
      { id: 3, name: "Sun", value: "#ffd43b" },
      { id: 4, name: "Violet", value: "#845ef7" },
    ];
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "screen color";

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = "Choose your color";

    const grid = document.createElement("div");
    grid.className = "color-grid";

    this.colors.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "color-btn";
      btn.style.background = c.value;
      btn.title = c.name;
      btn.addEventListener("click", () => {
        if (this.onChoose) this.onChoose(c);
      });
      grid.appendChild(btn);
    });

    card.appendChild(title);
    card.appendChild(grid);
    wrap.appendChild(card);

    this.root.appendChild(wrap);
    this.el = wrap;
  }

  destroy() {
    if (this.el) this.el.remove();
  }
}

window.Screens = window.Screens || {};
window.Screens.ColorScreen = ColorScreen;
