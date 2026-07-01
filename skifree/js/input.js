export class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this._onKeyDown = (e) => {
      if (!this.keys[e.code]) {
        this.justPressed[e.code] = true;
      }
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  isDown(code) {
    return !!this.keys[code];
  }

  wasPressed(code) {
    return !!this.justPressed[code];
  }

  clearFrame() {
    this.justPressed = {};
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
