import Phaser from "phaser";

interface HudPayload {
  score: number;
  coins: number;
  lives: number;
  level: string;
  time: number;
  power: "small" | "big" | "fire";
}

export class HudScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "Hud", active: false });
  }

  create() {
    this.text = this.add
      .text(8, 8, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#1a1a2e",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.scene.get("Game").events.on("hud", (p: HudPayload) => {
      this.text.setText(
        ` MARIO ${pad(p.score, 6)}  COINS x${pad(p.coins, 2)}  LV ${p.level}  LIVES ${p.lives}  POW ${p.power.toUpperCase()}  TIME ${p.time} `
      );
    });
  }
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, "0");
}
