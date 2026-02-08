class WaitingScreen {
  constructor(root, data) {
    this.root = root;
    this.endsInSec = data?.endsInSec ?? null;
    this.onCancel = data?.onCancel;
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "screen waiting";

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = "Waiting for match";

    this.timerEl = document.createElement("p");
    this.timerEl.textContent = this.endsInSec != null
      ? `Starts in ${this.endsInSec}s`
      : "Finding players...";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      if (this.onCancel) this.onCancel();
    });

    card.appendChild(title);
    card.appendChild(this.timerEl);
    card.appendChild(cancelBtn);
    wrap.appendChild(card);

    this.root.appendChild(wrap);
    this.el = wrap;
  }

  updateCountdown(sec) {
    this.endsInSec = sec;
    if (this.timerEl) {
      this.timerEl.textContent = `Starts in ${sec}s`;
    }
  }

  destroy() {
    if (this.el) this.el.remove();
  }
}

window.Screens = window.Screens || {};
window.Screens.WaitingScreen = WaitingScreen;
