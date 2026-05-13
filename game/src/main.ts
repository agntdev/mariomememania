import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { HudScene } from "./scenes/HudScene";
import { GameOverScene } from "./scenes/GameOverScene";

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 480;

export function bootGame(parent: HTMLElement | string = "game"): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    backgroundColor: "#5c94fc",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 900 },
        debug: false,
      },
    },
    scene: [BootScene, GameScene, HudScene, GameOverScene],
  });
}

if (typeof document !== "undefined" && document.getElementById("game")) {
  bootGame("game");
}
