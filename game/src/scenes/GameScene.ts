import Phaser from "phaser";
import { LEVELS, TILE_SIZE, type LevelDef } from "../levels";

export type PowerState = "small" | "big" | "fire";

interface SceneData {
  levelIndex?: number;
  carryScore?: number;
  carryLives?: number;
  carryPower?: PowerState;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private ground!: Phaser.Physics.Arcade.StaticGroup;
  private coins!: Phaser.Physics.Arcade.StaticGroup;
  private qblocks!: Phaser.Physics.Arcade.StaticGroup;
  private goombas!: Phaser.Physics.Arcade.Group;
  private mushrooms!: Phaser.Physics.Arcade.Group;
  private flowers!: Phaser.Physics.Arcade.Group;
  private fireballs!: Phaser.Physics.Arcade.Group;
  private flag!: Phaser.Physics.Arcade.Sprite;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private runKey!: Phaser.Input.Keyboard.Key;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private lastFire = 0;

  private levelIndex = 0;
  private level!: LevelDef;
  private score = 0;
  private coinsCollected = 0;
  private lives = 3;
  private power: PowerState = "small";
  private timeLeft = 0;
  private timeAccumulatorMs = 0;
  private completed = false;
  private invincibleUntil = 0;

  constructor() {
    super("Game");
  }

  init(data: SceneData) {
    this.levelIndex = data.levelIndex ?? 0;
    this.score = data.carryScore ?? 0;
    this.lives = data.carryLives ?? 3;
    this.power = data.carryPower ?? "small";
    this.coinsCollected = 0;
    this.completed = false;
    this.invincibleUntil = 0;
  }

  create() {
    this.level = LEVELS[this.levelIndex];
    this.timeLeft = this.level.timeLimit;
    this.timeAccumulatorMs = 0;

    this.ground = this.physics.add.staticGroup();
    this.coins = this.physics.add.staticGroup();
    this.qblocks = this.physics.add.staticGroup();
    this.goombas = this.physics.add.group({ allowGravity: true, collideWorldBounds: false });
    this.mushrooms = this.physics.add.group({ allowGravity: true });
    this.flowers = this.physics.add.group({ allowGravity: false });
    this.fireballs = this.physics.add.group({ allowGravity: true, bounceY: 0.6 });

    const worldWidth = this.level.rows[0].length * TILE_SIZE;
    const worldHeight = this.level.rows.length * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    let spawn = { x: 32, y: 32 };
    this.level.rows.forEach((row, ry) => {
      [...row].forEach((ch, cx) => {
        const x = cx * TILE_SIZE + TILE_SIZE / 2;
        const y = ry * TILE_SIZE + TILE_SIZE / 2;
        switch (ch) {
          case "#":
            this.ground.create(x, y, "ground").refreshBody();
            break;
          case "?":
            this.coins.create(x, y, "coin").refreshBody();
            break;
          case "M": {
            const b = this.qblocks.create(x, y, "qblock") as Phaser.Physics.Arcade.Sprite;
            b.setData("contains", "mushroom");
            b.setData("used", false);
            break;
          }
          case "F": {
            const b = this.qblocks.create(x, y, "qblock") as Phaser.Physics.Arcade.Sprite;
            b.setData("contains", "fireflower");
            b.setData("used", false);
            break;
          }
          case "G": {
            this.flag = this.physics.add.staticSprite(x, y - 24, "flag");
            this.flag.refreshBody();
            break;
          }
          case "P":
            spawn = { x, y: y - 8 };
            break;
          case "E": {
            const g = this.goombas.create(x, y - 8, "goomba") as Phaser.Physics.Arcade.Sprite;
            g.setVelocityX(-40);
            g.setCollideWorldBounds(false);
            g.setData("dir", -1);
            break;
          }
        }
      });
    });

    this.player = this.physics.add.sprite(spawn.x, spawn.y, this.powerTexture()).setCollideWorldBounds(true);
    this.player.body!.setSize(this.player.width - 2, this.player.height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.goombas, this.ground);
    this.physics.add.collider(this.mushrooms, this.ground);
    this.physics.add.collider(this.fireballs, this.ground, (fb) => {
      const body = (fb as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      if (body.blocked.left || body.blocked.right) (fb as Phaser.Physics.Arcade.Sprite).destroy();
    });
    this.physics.add.collider(this.player, this.qblocks, this.onHitQBlock, undefined, this);

    this.physics.add.overlap(this.player, this.coins, this.onCollectCoin, undefined, this);
    this.physics.add.overlap(this.player, this.goombas, this.onTouchGoomba, undefined, this);
    this.physics.add.overlap(this.player, this.mushrooms, this.onCollectMushroom, undefined, this);
    this.physics.add.overlap(this.player, this.flowers, this.onCollectFlower, undefined, this);
    this.physics.add.overlap(this.fireballs, this.goombas, this.onFireballGoomba, undefined, this);
    if (this.flag) this.physics.add.overlap(this.player, this.flag, this.onReachFlag, undefined, this);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.jumpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.runKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);

    this.events.emit("hud", this.hudPayload());
  }

  update(time: number, delta: number) {
    if (this.completed) return;

    this.timeAccumulatorMs += delta;
    if (this.timeAccumulatorMs >= 1000) {
      this.timeAccumulatorMs -= 1000;
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      this.events.emit("hud", this.hudPayload());
      if (this.timeLeft <= 0) this.die("time");
    }

    if (this.player.y > this.physics.world.bounds.height + 40) this.die("pit");

    const onFloor = this.player.body!.blocked.down || this.player.body!.touching.down;
    const running = this.runKey.isDown;
    const speed = running ? 180 : 120;

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if ((this.jumpKey.isDown || this.cursors.up.isDown) && onFloor) {
      this.player.setVelocityY(-380);
    }

    if (this.power === "fire" && Phaser.Input.Keyboard.JustDown(this.fireKey)) {
      if (time - this.lastFire > 250) {
        this.lastFire = time;
        this.spawnFireball();
      }
    }

    this.goombas.children.iterate((g) => {
      if (!g) return true;
      const sprite = g as Phaser.Physics.Arcade.Sprite;
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      if (body.blocked.left) {
        sprite.setVelocityX(40);
        sprite.setData("dir", 1);
      } else if (body.blocked.right) {
        sprite.setVelocityX(-40);
        sprite.setData("dir", -1);
      }
      if (sprite.y > this.physics.world.bounds.height + 40) sprite.destroy();
      return true;
    });
  }

  private powerTexture(): string {
    return this.power === "small" ? "mario-small" : this.power === "big" ? "mario-big" : "mario-fire";
  }

  private hudPayload() {
    return {
      score: this.score,
      coins: this.coinsCollected,
      lives: this.lives,
      level: this.level.id,
      time: this.timeLeft,
      power: this.power,
    };
  }

  private onCollectCoin(_player: unknown, coinObj: unknown) {
    const coin = coinObj as Phaser.GameObjects.GameObject;
    coin.destroy();
    this.score += 100;
    this.coinsCollected += 1;
    this.events.emit("hud", this.hudPayload());
  }

  private onHitQBlock(_player: unknown, blockObj: unknown) {
    const block = blockObj as Phaser.Physics.Arcade.Sprite;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (!body.touching.up) return;
    if (block.getData("used")) return;
    block.setData("used", true);
    block.setTexture("qblock-used");
    const contains = block.getData("contains") as string;
    if (contains === "mushroom") {
      const m = this.mushrooms.create(block.x, block.y - 16, "mushroom") as Phaser.Physics.Arcade.Sprite;
      m.setVelocityX(40);
    } else if (contains === "fireflower") {
      const f = this.flowers.create(block.x, block.y - 16, "fireflower") as Phaser.Physics.Arcade.Sprite;
      (f.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }
    this.score += 50;
    this.events.emit("hud", this.hudPayload());
  }

  private onCollectMushroom(_p: unknown, mObj: unknown) {
    (mObj as Phaser.GameObjects.GameObject).destroy();
    this.score += 1000;
    if (this.power === "small") this.applyPowerUp("big");
    this.events.emit("hud", this.hudPayload());
  }

  private onCollectFlower(_p: unknown, fObj: unknown) {
    (fObj as Phaser.GameObjects.GameObject).destroy();
    this.score += 1000;
    this.applyPowerUp("fire");
    this.events.emit("hud", this.hudPayload());
  }

  private applyPowerUp(next: PowerState) {
    this.power = next;
    const oldY = this.player.y;
    this.player.setTexture(this.powerTexture());
    this.player.body!.setSize(this.player.width - 2, this.player.height);
    this.player.y = oldY;
    this.invincibleUntil = this.time.now + 800;
  }

  private spawnFireball() {
    const dir = this.player.flipX ? -1 : 1;
    const fb = this.fireballs.create(
      this.player.x + dir * 8,
      this.player.y,
      "fireball"
    ) as Phaser.Physics.Arcade.Sprite;
    fb.setVelocity(dir * 260, 60);
    this.time.delayedCall(1200, () => fb.destroy());
  }

  private onFireballGoomba(fbObj: unknown, goombaObj: unknown) {
    (fbObj as Phaser.GameObjects.GameObject).destroy();
    (goombaObj as Phaser.GameObjects.GameObject).destroy();
    this.score += 200;
    this.events.emit("hud", this.hudPayload());
  }

  private onTouchGoomba(_p: unknown, gObj: unknown) {
    const goomba = gObj as Phaser.Physics.Arcade.Sprite;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const stomping = body.velocity.y > 0 && this.player.y < goomba.y - 4;
    if (stomping) {
      goomba.destroy();
      this.player.setVelocityY(-260);
      this.score += 200;
      this.events.emit("hud", this.hudPayload());
      return;
    }
    if (this.time.now < this.invincibleUntil) return;
    if (this.power !== "small") {
      this.applyPowerUp("small");
      return;
    }
    this.die("hit");
  }

  private onReachFlag() {
    if (this.completed) return;
    this.completed = true;
    this.score += this.timeLeft * 10;
    this.events.emit("hud", this.hudPayload());
    const nextIndex = this.levelIndex + 1;
    this.time.delayedCall(600, () => {
      if (nextIndex < LEVELS.length) {
        this.scene.restart({
          levelIndex: nextIndex,
          carryScore: this.score,
          carryLives: this.lives,
          carryPower: this.power,
        });
      } else {
        this.scene.start("GameOver", { score: this.score, won: true });
      }
    });
  }

  private die(_reason: "pit" | "hit" | "time") {
    this.lives -= 1;
    this.events.emit("hud", this.hudPayload());
    if (this.lives <= 0) {
      this.scene.start("GameOver", { score: this.score, won: false });
    } else {
      this.scene.restart({
        levelIndex: this.levelIndex,
        carryScore: this.score,
        carryLives: this.lives,
        carryPower: "small",
      });
    }
  }
}
