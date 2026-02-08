class StateMachine {
  constructor(root) {
    this.root = root;
    this.current = null;
    this.currentName = null;
  }

  setScreen(name, data) {
    if (this.current && this.current.destroy) {
      this.current.destroy();
    }
    this.root.innerHTML = "";

    const ScreenClass = window.Screens[name];
    if (!ScreenClass) {
      throw new Error(`Unknown screen: ${name}`);
    }

    this.currentName = name;
    this.current = new ScreenClass(this.root, data);
    if (this.current.render) {
      this.current.render();
    }
  }
}

window.StateMachine = StateMachine;
