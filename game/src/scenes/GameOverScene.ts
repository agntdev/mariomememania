import Phaser from "phaser";

interface GameOverData {
  score: number;
  won: boolean;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  create(data: GameOverData) {
    this.scene.stop("Hud");
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#1a1a2e");

    this.add
      .text(width / 2, height / 2 - 40, data.won ? "YOU WIN!" : "GAME OVER", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: data.won ? "#fbd000" : "#e52521",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 4, `SCORE: ${data.score}`, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 48, "Press SPACE to restart", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.input.keyboard!.once("keydown-SPACE", () => {
      this.scene.start("Game", { levelIndex: 0 });
      this.scene.launch("Hud");
    });
  }
}
