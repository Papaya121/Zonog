class ResultsScreen {
  constructor(root, data) {
    this.root = root;
    this.title = data?.title || "Results";
    this.results = data?.results || [];
    this.onPlayAgain = data?.onPlayAgain;
    this.onBack = data?.onBack;
  }

  render() {
    const wrap = document.createElement("div");
    wrap.className = "screen results";

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = this.title;

    const list = document.createElement("div");
    list.className = "results-list";

    if (this.results.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No results yet";
      list.appendChild(empty);
    } else {
      this.results.forEach((r) => {
        const row = document.createElement("div");
        row.className = "results-row";
        row.textContent = `${r.place}. ${r.name} — ${r.score}%`;
        list.appendChild(row);
      });
    }

    const againBtn = document.createElement("button");
    againBtn.className = "btn primary";
    againBtn.textContent = "Play again";
    againBtn.addEventListener("click", () => {
      if (this.onPlayAgain) this.onPlayAgain();
    });

    const backBtn = document.createElement("button");
    backBtn.className = "btn";
    backBtn.textContent = "Back to menu";
    backBtn.addEventListener("click", () => {
      if (this.onBack) this.onBack();
    });

    card.appendChild(title);
    card.appendChild(list);
    card.appendChild(againBtn);
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
window.Screens.ResultsScreen = ResultsScreen;
