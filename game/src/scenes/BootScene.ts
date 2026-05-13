import Phaser from "phaser";

/**
 * Generates all the pixel-art textures procedurally so the game has zero
 * binary asset dependencies and stays diff-reviewable.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    makeBlock(this, "ground", "#8b4513", "#5b2c0c");
    makeBlock(this, "brick", "#c84c0c", "#8b3306");
    makeBlock(this, "qblock", "#fbd000", "#8b6a00");
    makeBlock(this, "qblock-used", "#666666", "#222222");

    makeCoin(this);
    makeMario(this, "mario-small", 12, 16, "#e52521");
    makeMario(this, "mario-big", 12, 24, "#e52521");
    makeMario(this, "mario-fire", 12, 24, "#ffffff");
    makeGoomba(this);
    makeMushroom(this);
    makeFireFlower(this);
    makeFlag(this);
    makeFireball(this);

    this.scene.start("Game", { levelIndex: 0 });
    this.scene.launch("Hud");
  }
}

function makeBlock(scene: Phaser.Scene, key: string, fill: string, shadow: string) {
  const g = scene.add.graphics();
  g.fillStyle(Phaser.Display.Color.HexStringToColor(fill).color, 1);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(shadow).color, 1);
  g.fillRect(0, 13, 16, 3);
  g.fillRect(13, 0, 3, 16);
  g.lineStyle(1, 0x1a1a2e, 1);
  g.strokeRect(0, 0, 16, 16);
  g.generateTexture(key, 16, 16);
  g.destroy();
}

function makeCoin(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0xfbd000, 1);
  g.fillRect(2, 0, 4, 8);
  g.fillStyle(0xffce42, 1);
  g.fillRect(1, 1, 6, 6);
  g.fillStyle(0xfff7a8, 1);
  g.fillRect(3, 2, 2, 4);
  g.generateTexture("coin", 8, 8);
  g.destroy();
}

function makeMario(scene: Phaser.Scene, key: string, w: number, h: number, hatColor: string) {
  const g = scene.add.graphics();
  const hat = Phaser.Display.Color.HexStringToColor(hatColor).color;
  g.fillStyle(hat, 1);
  g.fillRect(0, 0, w, Math.floor(h / 3));
  g.fillStyle(0xfac090, 1);
  g.fillRect(2, Math.floor(h / 3), w - 4, Math.floor(h / 4));
  g.fillStyle(0x1a1a2e, 1);
  g.fillRect(3, Math.floor(h / 3) + 1, 2, 2);
  g.fillRect(7, Math.floor(h / 3) + 1, 2, 2);
  g.fillStyle(0x0066cc, 1);
  g.fillRect(0, Math.floor(h / 2), w, Math.floor(h / 2) - 2);
  g.fillStyle(0x5b2c0c, 1);
  g.fillRect(0, h - 2, Math.floor(w / 2), 2);
  g.fillRect(Math.floor(w / 2), h - 2, Math.floor(w / 2), 2);
  g.generateTexture(key, w, h);
  g.destroy();
}

function makeGoomba(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x8b4513, 1);
  g.fillRect(0, 2, 14, 10);
  g.fillStyle(0x5b2c0c, 1);
  g.fillRect(0, 10, 14, 4);
  g.fillStyle(0xffffff, 1);
  g.fillRect(2, 4, 3, 3);
  g.fillRect(9, 4, 3, 3);
  g.fillStyle(0x1a1a2e, 1);
  g.fillRect(3, 5, 2, 2);
  g.fillRect(10, 5, 2, 2);
  g.generateTexture("goomba", 14, 14);
  g.destroy();
}

function makeMushroom(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0xe52521, 1);
  g.fillRect(0, 0, 14, 8);
  g.fillStyle(0xffffff, 1);
  g.fillRect(2, 2, 3, 3);
  g.fillRect(9, 2, 3, 3);
  g.fillStyle(0xfac090, 1);
  g.fillRect(2, 8, 10, 6);
  g.generateTexture("mushroom", 14, 14);
  g.destroy();
}

function makeFireFlower(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x43b047, 1);
  g.fillRect(6, 8, 2, 6);
  g.fillStyle(0xfbd000, 1);
  g.fillRect(4, 2, 6, 6);
  g.fillStyle(0xe52521, 1);
  g.fillRect(5, 3, 4, 4);
  g.fillStyle(0xffffff, 1);
  g.fillRect(6, 4, 2, 2);
  g.generateTexture("fireflower", 14, 14);
  g.destroy();
}

function makeFlag(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x888888, 1);
  g.fillRect(7, 0, 2, 64);
  g.fillStyle(0x43b047, 1);
  g.fillRect(9, 4, 12, 8);
  g.generateTexture("flag", 24, 64);
  g.destroy();
}

function makeFireball(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0xe52521, 1);
  g.fillCircle(4, 4, 4);
  g.fillStyle(0xfbd000, 1);
  g.fillCircle(4, 4, 2);
  g.generateTexture("fireball", 8, 8);
  g.destroy();
}
