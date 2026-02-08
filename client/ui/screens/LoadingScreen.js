class LoadingScreen {
  constructor(root, data) {
    this.root = root;
    this.onContinue = data?.onContinue;
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "screen loading";

    const title = document.createElement("h1");
    title.textContent = "Zonog";

    const status = document.createElement("p");
    status.textContent = "Loading assets...";

    const button = document.createElement("button");
    button.className = "btn primary";
    button.textContent = "Continue";
    button.addEventListener("click", () => {
      if (this.onContinue) this.onContinue();
    });

    wrap.appendChild(title);
    wrap.appendChild(status);
    wrap.appendChild(button);

    this.root.appendChild(wrap);
    this.el = wrap;
  }

  destroy() {
    if (this.el) this.el.remove();
  }
}

window.Screens = window.Screens || {};
window.Screens.LoadingScreen = LoadingScreen;
