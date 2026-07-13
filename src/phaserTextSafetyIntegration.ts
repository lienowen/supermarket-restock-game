import Phaser from "phaser";

type RuntimeText = Phaser.GameObjects.Text & {
  canvas?: HTMLCanvasElement | null;
  context?: CanvasRenderingContext2D | null;
};

type TextPrototype = {
  setColor: (this: RuntimeText, color?: string) => Phaser.GameObjects.Text;
};

const prototype = Phaser.GameObjects.Text.prototype as unknown as TextPrototype;
const originalSetColor = prototype.setColor;

prototype.setColor = function safeSetColor(color?: string): Phaser.GameObjects.Text {
  // Some legacy scene integrations can receive one final event after their
  // Text object has already been destroyed during a scene transition. Phaser
  // then tries to redraw a released canvas and throws from drawImage().
  if (!this.active || !this.scene || !this.canvas || !this.context) return this;
  return originalSetColor.call(this, color);
};
