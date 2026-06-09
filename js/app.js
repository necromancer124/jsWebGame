
const bgMusic = document.getElementById("bg-music");
function startBackgroundMusic(){
    if(!bgMusic) return;
    bgMusic.volume = 0.35;
    bgMusic.play().catch(()=>{});
}
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const gameContainer = document.getElementById("game-container");
const gameOverScreen = document.getElementById("game-over-screen");
const pauseScreen = document.getElementById("pause-screen");

const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const toast = document.getElementById("toast");
const questLog = document.getElementById("quest-log");
const uiHeader = document.getElementById("ui-header");

const uiHealth = document.getElementById("ui-health");
const uiStamina = document.getElementById("ui-stamina");
const uiGold = document.getElementById("ui-gold");
const uiKills = document.getElementById("ui-kills");
const uiLevel = document.getElementById("ui-level");
const uiWeapon = document.getElementById("ui-weapon");
const uiDmg = document.getElementById("ui-dmg");
const uiArmor = document.getElementById("ui-armor");
const uiDef = document.getElementById("ui-def");

const endTitle = document.getElementById("end-title");
const endMessage = document.getElementById("end-message");
const uiFinalGold = document.getElementById("ui-final-gold");
const uiFinalKills = document.getElementById("ui-final-kills");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const VICTORY_GOLD = 25;

const keys = new Set();
let player;
let enemies = [];
let lootItems = [];
let chests = [];
let potions = [];
let particles = [];
let floatingTexts = [];
let ghostSouls = [];
let obstacles = [];

let gameActive = false;
let paused = false;
let muted = false;
let lastTime = 0;
let spawnClock = 0;
let chestClock = 0;
let potionClock = 0;
let shakeTime = 0;
let shakeStrength = 0;
let toastTimer = 0;

let gold = 0;
let kills = 0;
let level = 1;
let enemyBaseSpeed = 70;
let bossSpawned = false;
let bossDefeated = false;

const weaponPool = [
    { name: "Steel Sword", damage: 20, range: 52, colorClass: "rarity-common" },
    { name: "Orcish Axe", damage: 28, range: 48, colorClass: "rarity-uncommon" },
    { name: "Dwarven Mace", damage: 38, range: 44, colorClass: "rarity-rare" },
    { name: "Glass Greatsword", damage: 54, range: 68, colorClass: "rarity-epic" },
    { name: "Daedric Warhammer", damage: 76, range: 58, colorClass: "rarity-legendary" }
];

const armorPool = [
    { name: "Iron Armor", defense: 0.18, colorClass: "rarity-common" },
    { name: "Steel Armor", defense: 0.28, colorClass: "rarity-common" },
    { name: "Orcish Armor", defense: 0.38, colorClass: "rarity-uncommon" },
    { name: "Daedric Armor", defense: 0.55, colorClass: "rarity-epic" },
    { name: "Dragon Scale Armor", defense: 0.68, colorClass: "rarity-legendary" }
];

const enemyTypes = {
    bandit: { size: 24, speed: 1, damage: 10, hp: 24, color: "#c0392b", gold: 1 },
    goblin: { size: 20, speed: 1.45, damage: 5, hp: 12, color: "#2ecc71", gold: 2 },
    wraith: { size: 26, speed: 1.2, damage: 14, hp: 34, color: "#74b9ff", gold: 2 },
    furryOrc: { size: 34, speed: 0.9, damage: 16, hp: 58, color: "#8e6f4e", gold: 3 },
    dragon: { size: 42, speed: 0.85, damage: 24, hp: 80, color: "#8e44ad", gold: 4 },
    boss: { size: 62, speed: 0.78, damage: 30, hp: 240, color: "#d35400", gold: 10 }
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function random(min, max) {
    return min + Math.random() * (max - min);
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
}

function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}

function blocked(rect) {
    // Decorative scenery is now "noclip": it is visible, but never blocks player/enemy movement.
    return false;
}

function playTone(freq, duration = 0.06, type = "square", volume = 0.04) {
    if (muted) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audio = playTone.audio || new AudioContext();
        playTone.audio = audio;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
        osc.stop(audio.currentTime + duration);
    } catch (_) {
        // Some browsers block audio until user interaction. Gameplay still works.
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    toastTimer = 2.2;
}

function shake(_strength, _seconds) {
    // Screen shake was removed so the game view no longer jumps.
    shakeStrength = 0;
    shakeTime = 0;
}

function addParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x,
            y,
            vx: random(-90, 90),
            vy: random(-90, 90),
            life: random(0.25, 0.65),
            maxLife: 0.65,
            size: random(2, 5),
            color
        });
    }
}

function addText(text, x, y, color = "#ffffff") {
    floatingTexts.push({ text, x, y, color, life: 0.9 });
}

function addGhostSoul(x, y) {
    ghostSouls.push({
        x,
        y,
        vx: random(-18, 18),
        vy: random(-95, -55),
        sway: random(0, Math.PI * 2),
        life: 1.7,
        maxLife: 1.7,
        size: random(14, 20)
    });
}

class Dragonborn {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 30;
        this.baseSpeed = 185;
        this.facing = "down";
        this.health = 100;
        this.stamina = 100;
        this.invulnerable = 0;
        this.dashCooldown = 0;
        this.dashTime = 0;
        this.dashVx = 0;
        this.dashVy = 0;
        this.shoutCooldown = 0;

        this.weaponName = "Iron Dagger";
        this.weaponDamage = 10;
        this.weaponRange = 42;
        this.weaponClass = "rarity-common";

        this.armorName = "Rags";
        this.armorDefense = 0;
        this.armorClass = "rarity-common";

        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackDuration = 0.16;
        this.attackBox = { x: 0, y: 0, width: 0, height: 0 };
        this.hitThisSwing = new Set();
    }

    get box() {
        return { x: this.x, y: this.y, width: this.size, height: this.size };
    }

    update(dt) {
        let dx = 0;
        let dy = 0;
        if (keys.has("KeyW") || keys.has("ArrowUp")) { dy -= 1; this.facing = "up"; }
        if (keys.has("KeyS") || keys.has("ArrowDown")) { dy += 1; this.facing = "down"; }
        if (keys.has("KeyA") || keys.has("ArrowLeft")) { dx -= 1; this.facing = "left"; }
        if (keys.has("KeyD") || keys.has("ArrowRight")) { dx += 1; this.facing = "right"; }

        const moving = dx !== 0 || dy !== 0;
        if (moving) {
            const len = Math.hypot(dx, dy);
            dx /= len;
            dy /= len;
        }

        let moveX = dx;
        let moveY = dy;
        let speed = this.baseSpeed;

        if (this.dashTime > 0) {
            moveX = this.dashVx;
            moveY = this.dashVy;
            speed = 920;
            this.dashTime = Math.max(0, this.dashTime - dt);
        } else {
            this.stamina = clamp(this.stamina + 28 * dt, 0, 100);
        }

        const nextX = clamp(this.x + moveX * speed * dt, 0, WIDTH - this.size);
        const nextY = clamp(this.y + moveY * speed * dt, 0, HEIGHT - this.size);
        const xBox = { x: nextX, y: this.y, width: this.size, height: this.size };
        const yBox = { x: this.x, y: nextY, width: this.size, height: this.size };
        if (!blocked(xBox)) this.x = nextX;
        if (!blocked(yBox)) this.y = nextY;

        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        this.shoutCooldown = Math.max(0, this.shoutCooldown - dt);

        if (this.isAttacking) {
            this.attackTimer -= dt;
            this.updateAttackBox();
            if (this.attackTimer <= 0) this.isAttacking = false;
        }
    }

    attack() {
        if (this.isAttacking) return;
        this.isAttacking = true;
        this.attackTimer = this.attackDuration;
        this.hitThisSwing.clear();
        this.updateAttackBox();
        playTone(280, 0.05, "sawtooth", 0.035);
    }

    dash() {
        if (this.dashCooldown > 0 || this.dashTime > 0) return;
        if (this.stamina < 50) {
            showToast("Not enough stamina for dash.");
            return;
        }

        let dx = 0;
        let dy = 0;
        if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;

        if (dx === 0 && dy === 0) {
            if (this.facing === "up") dy = -1;
            else if (this.facing === "down") dy = 1;
            else if (this.facing === "left") dx = -1;
            else if (this.facing === "right") dx = 1;
        }

        const len = Math.hypot(dx, dy) || 1;
        this.dashVx = dx / len;
        this.dashVy = dy / len;
        this.dashTime = 0.14;
        this.dashCooldown = 0.34;
        this.invulnerable = Math.max(this.invulnerable, 0.12);
        this.stamina = clamp(this.stamina - 50, 0, 100);

        addParticles(this.x + this.size / 2, this.y + this.size / 2, "#74b9ff", 12);
        addText("DASH", this.x, this.y - 8, "#74b9ff");
        playTone(180, 0.06, "sawtooth", 0.045);
    }

    shout() {
        if (this.shoutCooldown > 0 || this.stamina < 45) {
            showToast("Shout is not ready.");
            return;
        }
        this.stamina -= 45;
        this.shoutCooldown = 7;
        const cx = this.x + this.size / 2;
        const cy = this.y + this.size / 2;
        enemies.forEach(enemy => {
            const ex = enemy.x + enemy.size / 2;
            const ey = enemy.y + enemy.size / 2;
            const dist = distance(cx, cy, ex, ey);
            if (dist < 170) {
                const nx = (ex - cx) / Math.max(1, dist);
                const ny = (ey - cy) / Math.max(1, dist);
                enemy.x += nx * 80;
                enemy.y += ny * 80;
                enemy.hp -= 18;
                addText("FUS!", enemy.x, enemy.y, "#74b9ff");
                addParticles(enemy.x, enemy.y, "#74b9ff", 8);
            }
        });
        playTone(90, 0.18, "sawtooth", 0.06);
        shake(8, 0.2);
    }

    updateAttackBox() {
        const range = this.weaponRange;
        const spread = 12;
        if (this.facing === "up") {
            this.attackBox = { x: this.x - spread / 2, y: this.y - range, width: this.size + spread, height: range };
        } else if (this.facing === "down") {
            this.attackBox = { x: this.x - spread / 2, y: this.y + this.size, width: this.size + spread, height: range };
        } else if (this.facing === "left") {
            this.attackBox = { x: this.x - range, y: this.y - spread / 2, width: range, height: this.size + spread };
        } else {
            this.attackBox = { x: this.x + this.size, y: this.y - spread / 2, width: range, height: this.size + spread };
        }
    }

    draw() {
        if (this.invulnerable > 0 && Math.floor(this.invulnerable * 20) % 2 === 0) return;

        ctx.fillStyle = "#3a7bd5";
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.fillStyle = "#1f2f46";
        ctx.fillRect(this.x + 5, this.y + 7, 20, 18);

        ctx.fillStyle = "#ecf0f1";
        if (this.facing === "up") ctx.fillRect(this.x + 12, this.y, 6, 5);
        if (this.facing === "down") ctx.fillRect(this.x + 12, this.y + this.size - 5, 6, 5);
        if (this.facing === "left") ctx.fillRect(this.x, this.y + 12, 5, 6);
        if (this.facing === "right") ctx.fillRect(this.x + this.size - 5, this.y + 12, 5, 6);

        if (this.isAttacking) {
            ctx.fillStyle = "rgba(241, 196, 15, 0.55)";
            ctx.fillRect(this.attackBox.x, this.attackBox.y, this.attackBox.width, this.attackBox.height);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
            ctx.strokeRect(this.attackBox.x, this.attackBox.y, this.attackBox.width, this.attackBox.height);
        }

        if (this.shoutCooldown <= 0) {
            ctx.strokeStyle = "rgba(116, 185, 255, 0.6)";
            ctx.beginPath();
            ctx.arc(this.x + this.size / 2, this.y + this.size / 2, 22, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

class Enemy {
    constructor(x, y, type) {
        const stats = enemyTypes[type];
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = stats.size;
        this.speed = stats.speed * enemyBaseSpeed;
        this.damage = stats.damage;
        this.hp = stats.hp + level * 3;
        this.maxHp = this.hp;
        this.color = stats.color;
        this.gold = stats.gold;
        this.attackCooldown = 0;
    }

    get box() {
        return { x: this.x, y: this.y, width: this.size, height: this.size };
    }

    update(dt) {
        const targetX = player.x + player.size / 2;
        const targetY = player.y + player.size / 2;
        const cx = this.x + this.size / 2;
        const cy = this.y + this.size / 2;
        const dx = targetX - cx;
        const dy = targetY - cy;
        const dist = Math.hypot(dx, dy);

        if (dist > 2) {
            const nx = dx / dist;
            const ny = dy / dist;
            const nextX = clamp(this.x + nx * this.speed * dt, -70, WIDTH + 70);
            const nextY = clamp(this.y + ny * this.speed * dt, -70, HEIGHT + 70);
            const nextBox = { x: nextX, y: nextY, width: this.size, height: this.size };
            if (!blocked(nextBox) || this.type === "boss") {
                this.x = nextX;
                this.y = nextY;
            }
        }
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);

        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.fillRect(this.x, this.y - 8, this.size, 4);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(this.x, this.y - 8, this.size * (this.hp / this.maxHp), 4);

        ctx.fillStyle = "#111";
        if (this.type === "dragon" || this.type === "boss") {
            ctx.fillRect(this.x - 7, this.y + this.size * 0.32, 7, this.size * 0.32);
            ctx.fillRect(this.x + this.size, this.y + this.size * 0.32, 7, this.size * 0.32);
        } else if (this.type === "furryOrc") {
            ctx.fillStyle = "#5d4037";
            ctx.fillRect(this.x + 4, this.y + 6, this.size - 8, this.size - 3);
            ctx.fillStyle = "#f8c8dc";
            ctx.fillRect(this.x + 7, this.y - 5, 7, 10);
            ctx.fillRect(this.x + this.size - 14, this.y - 5, 7, 10);
            ctx.fillStyle = "#111";
            ctx.fillRect(this.x + 9, this.y + 12, 4, 4);
            ctx.fillRect(this.x + this.size - 13, this.y + 12, 4, 4);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 10px Segoe UI";
            ctx.textAlign = "center";
        } else if (this.type === "goblin") {
            ctx.fillStyle = "#8B4513";
            ctx.fillRect(this.x + 4, this.y - 6, 12, 8);
        } else if (this.type === "wraith") {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
            ctx.strokeRect(this.x + 5, this.y + 5, this.size - 10, this.size - 10);
        } else {
            ctx.fillRect(this.x, this.y + 4, this.size, 4);
        }
    }
}

class Loot {
    constructor(x, y, value = 1) {
        this.x = x;
        this.y = y;
        this.radius = 8 + Math.min(value, 4);
        this.value = value;
        this.pulse = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.pulse += dt * 5;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + Math.sin(this.pulse) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "#d4af37";
        ctx.fill();
        ctx.strokeStyle = "#fff7bd";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class Potion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 15;
    }

    get box() {
        return { x: this.x, y: this.y, width: this.size, height: this.size };
    }

    draw() {
        ctx.fillStyle = "#e74c3c";
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.fillStyle = "#ecf0f1";
        ctx.fillRect(this.x + 4, this.y - 4, 7, 4);
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.strokeRect(this.x, this.y, this.size, this.size);
    }
}

class Chest {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 24;
        this.openHint = false;
        const pool = Math.random() > 0.5 ? weaponPool : armorPool;
        this.lootType = pool === weaponPool ? "weapon" : "armor";
        this.item = pool[Math.floor(Math.random() * pool.length)];
    }

    get box() {
        return { x: this.x, y: this.y, width: this.size, height: this.size };
    }

    draw() {
        const label = `${this.lootType.toUpperCase()}: ${this.item.name}`;

        // Always show what the chest contains.
        ctx.save();
        ctx.font = "bold 12px Segoe UI";
        ctx.textAlign = "center";
        const labelX = this.x + this.size / 2;
        const labelY = this.y - 12;
        const labelWidth = ctx.measureText(label).width + 12;
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(labelX - labelWidth / 2, labelY - 14, labelWidth, 17);
        ctx.fillStyle = this.lootType === "weapon" ? "#f1c40f" : "#74b9ff";
        ctx.fillText(label, labelX, labelY);
        ctx.restore();

        ctx.fillStyle = "#8B4513";
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(this.x + 8, this.y + 9, 8, 6);
        ctx.strokeStyle = this.openHint ? "#ffffff" : "rgba(0,0,0,0.45)";
        ctx.lineWidth = this.openHint ? 2 : 1;
        ctx.strokeRect(this.x, this.y, this.size, this.size);

        if (this.openHint) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText("Press E", this.x + this.size / 2, this.y - 32);
        }
    }
}

function generateWorld() {
    obstacles = [
        { x: 92, y: 110, width: 78, height: 34, type: "rock" },
        { x: 610, y: 85, width: 84, height: 42, type: "rock" },
        { x: 335, y: 250, width: 52, height: 120, type: "tree" },
        { x: 120, y: 420, width: 110, height: 38, type: "log" },
        { x: 575, y: 420, width: 70, height: 88, type: "ruin" }
    ];
}

function safeRandomPosition(padding = 45) {
    for (let attempt = 0; attempt < 60; attempt++) {
        const x = random(padding, WIDTH - padding);
        const y = random(padding, HEIGHT - padding);
        const rect = { x: x - 16, y: y - 16, width: 32, height: 32 };
        if (!blocked(rect) && distance(x, y, player?.x || WIDTH / 2, player?.y || HEIGHT / 2) > 80) {
            return { x, y };
        }
    }
    return { x: WIDTH / 2, y: HEIGHT / 2 };
}

function spawnEnemy(typeOverride = null) {
    let x;
    let y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -55 : WIDTH + 55;
        y = random(0, HEIGHT);
    } else {
        x = random(0, WIDTH);
        y = Math.random() < 0.5 ? -55 : HEIGHT + 55;
    }

    let type = typeOverride || "bandit";
    if (!typeOverride) {
        const roll = Math.random();
        if (level >= 4 && roll < 0.16) type = "dragon";
        else if (level >= 2 && roll < 0.29) type = "furryOrc";
        else if (level >= 3 && roll < 0.43) type = "wraith";
        else if (roll > 0.76) type = "goblin";
    }
    enemies.push(new Enemy(x, y, type));
}

function spawnLoot(value = 1, x = null, y = null) {
    const pos = x === null ? safeRandomPosition() : { x, y };
    lootItems.push(new Loot(pos.x, pos.y, value));
}

function spawnChest() {
    const pos = safeRandomPosition(55);
    chests.push(new Chest(pos.x, pos.y));
    showToast("A chest appeared. Press E near it.");
}

function updateSystems(dt) {
    spawnClock -= dt;
    chestClock -= dt;
    potionClock -= dt;
    shakeTime = Math.max(0, shakeTime - dt);

    if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toast.classList.add("hidden");
    }

    const spawnDelay = clamp(1.55 - level * 0.12, 0.55, 1.55);
    if (spawnClock <= 0) {
        spawnEnemy();
        spawnClock = spawnDelay;
    }

    if (chestClock <= 0) {
        if (chests.length < 3) spawnChest();
        chestClock = 11.5;
    }

    if (potionClock <= 0 && Math.random() < 0.35) {
        const pos = safeRandomPosition();
        potions.push(new Potion(pos.x, pos.y));
        potionClock = 16;
    }

    lootItems.forEach(item => item.update(dt));
    particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);

    floatingTexts.forEach(t => {
        t.y -= 38 * dt;
        t.life -= dt;
    });
    floatingTexts = floatingTexts.filter(t => t.life > 0);

    ghostSouls.forEach(g => {
        g.sway += dt * 7;
        g.x += (g.vx + Math.sin(g.sway) * 24) * dt;
        g.y += g.vy * dt;
        g.life -= dt;
    });
    ghostSouls = ghostSouls.filter(g => g.life > 0);
}

function updateGame(dt) {
    player.update(dt);
    updateSystems(dt);

    const playerBox = player.box;

    for (let i = potions.length - 1; i >= 0; i--) {
        if (rectsOverlap(playerBox, potions[i].box)) {
            potions.splice(i, 1);
            player.health = clamp(player.health + 30, 0, 100);
            addText("+30 HP", player.x, player.y, "#2ecc71");
            playTone(620, 0.08, "triangle", 0.045);
        }
    }

    chests.forEach(chest => {
        chest.openHint = distance(player.x, player.y, chest.x, chest.y) < 55;
    });

    for (let i = lootItems.length - 1; i >= 0; i--) {
        const loot = lootItems[i];
        const coinBox = { x: loot.x - loot.radius, y: loot.y - loot.radius, width: loot.radius * 2, height: loot.radius * 2 };
        if (rectsOverlap(playerBox, coinBox)) {
            lootItems.splice(i, 1);
            gainGold(loot.value);
            addParticles(loot.x, loot.y, "#d4af37", 8);
            playTone(920, 0.05, "triangle", 0.035);
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update(dt);

        if (player.isAttacking && rectsOverlap(player.attackBox, enemy.box) && !player.hitThisSwing.has(enemy)) {
            player.hitThisSwing.add(enemy);
            enemy.hp -= player.weaponDamage;
            const knock = enemy.type === "boss" ? 14 : 32;
            const dirX = enemy.x + enemy.size / 2 - (player.x + player.size / 2);
            const dirY = enemy.y + enemy.size / 2 - (player.y + player.size / 2);
            const len = Math.max(1, Math.hypot(dirX, dirY));
            enemy.x += (dirX / len) * knock;
            enemy.y += (dirY / len) * knock;
            addText(`-${player.weaponDamage}`, enemy.x, enemy.y, "#f1c40f");
            addParticles(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, 10);
            playTone(180, 0.05, "square", 0.04);

            if (enemy.hp <= 0) {
                defeatEnemy(enemy, i);
                continue;
            }
        }

        if (rectsOverlap(playerBox, enemy.box) && enemy.attackCooldown <= 0 && player.invulnerable <= 0) {
            const rawDamage = enemy.damage;
            const damage = Math.max(1, Math.round(rawDamage * (1 - player.armorDefense)));
            player.health -= damage;
            player.invulnerable = 0.75;
            enemy.attackCooldown = enemy.type === "boss" ? 0.55 : 0.9;
            addText(`-${damage} HP`, player.x, player.y - 4, "#ff4757");
            shake(6, 0.18);
            playTone(95, 0.08, "sawtooth", 0.045);

            const dx = player.x + player.size / 2 - (enemy.x + enemy.size / 2);
            const dy = player.y + player.size / 2 - (enemy.y + enemy.size / 2);
            const len = Math.max(1, Math.hypot(dx, dy));
            player.x = clamp(player.x + (dx / len) * 26, 0, WIDTH - player.size);
            player.y = clamp(player.y + (dy / len) * 26, 0, HEIGHT - player.size);

            if (player.health <= 0) {
                endGame(false);
                return;
            }
        }
    }

    if (gold >= VICTORY_GOLD && !bossSpawned) {
        bossSpawned = true;
        bossDefeated = false;
        questLog.textContent = "Quest: The Dragon Priest has arrived. Defeat it to win.";
        showToast("Boss wave incoming!");
        spawnEnemy("boss");
        spawnEnemy("dragon");
        spawnEnemy("dragon");
        shake(10, 0.35);
    }

    if (bossSpawned && bossDefeated) {
        endGame(true);
    }

    updateUi();
}

function defeatEnemy(enemy, index) {
    enemies.splice(index, 1);
    kills++;
    spawnLoot(enemy.gold, enemy.x + enemy.size / 2, enemy.y + enemy.size / 2);
    addText("Defeated", enemy.x, enemy.y, "#ffffff");
    addParticles(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2, enemy.color, enemy.type === "boss" ? 28 : 14);

    if (enemy.type === "furryOrc") {
        addText("uwu", enemy.x + enemy.size / 2, enemy.y - 12, "#ff9ff3");
        showToast("The furry ork whispers: uwu");
        playTone(740, 0.07, "triangle", 0.04);
    }

    if (Math.random() < 0.42 || enemy.type === "wraith" || enemy.type === "boss") {
        addGhostSoul(enemy.x + enemy.size / 2, enemy.y + enemy.size / 2);
    }

    if (enemy.type === "goblin") {
        potions.push(new Potion(enemy.x, enemy.y));
    }

    if (enemy.type === "boss") {
        bossDefeated = true;
        playTone(130, 0.22, "sawtooth", 0.06);
    }
}

function gainGold(amount) {
    gold += amount;
    const newLevel = 1 + Math.floor(gold / 5);
    if (newLevel > level) {
        level = newLevel;
        enemyBaseSpeed += 8;
        player.health = clamp(player.health + 15, 0, 100);
        player.stamina = 100;
        showToast(`Level ${level}! You feel stronger.`);
        shake(4, 0.18);
    }
    if (!bossSpawned) {
        questLog.textContent = `Quest: Gather ${VICTORY_GOLD} gold. ${Math.max(0, VICTORY_GOLD - gold)} gold remaining.`;
    }
}

function openNearbyChest() {
    for (let i = chests.length - 1; i >= 0; i--) {
        const chest = chests[i];
        if (distance(player.x, player.y, chest.x, chest.y) < 58) {
            chests.splice(i, 1);
            if (chest.lootType === "weapon") {
                if (chest.item.damage >= player.weaponDamage) {
                    player.weaponName = chest.item.name;
                    player.weaponDamage = chest.item.damage;
                    player.weaponRange = chest.item.range;
                    player.weaponClass = chest.item.colorClass;
                    showToast(`Equipped ${chest.item.name}.`);
                } else {
                    gainGold(2);
                    showToast("Sold weaker weapon for 2 gold.");
                }
            } else {
                if (chest.item.defense >= player.armorDefense) {
                    player.armorName = chest.item.name;
                    player.armorDefense = chest.item.defense;
                    player.armorClass = chest.item.colorClass;
                    showToast(`Equipped ${chest.item.name}.`);
                } else {
                    gainGold(2);
                    showToast("Sold weaker armor for 2 gold.");
                }
            }
            addParticles(chest.x, chest.y, "#d4af37", 18);
            playTone(720, 0.08, "triangle", 0.05);
            updateUi();
            return;
        }
    }
    showToast("No chest nearby.");
}


function fitTopBarText() {
    if (!uiHeader || gameContainer.classList.contains("hidden")) return;

    uiHeader.style.setProperty("--ui-font-size", "15px");

    const minSize = 9;
    let size = 15;

    while (size > minSize && uiHeader.scrollWidth > uiHeader.clientWidth) {
        size -= 0.5;
        uiHeader.style.setProperty("--ui-font-size", `${size}px`);
    }
}

function updateUi() {
    uiHealth.textContent = Math.max(0, Math.round(player.health));
    uiStamina.textContent = Math.round(player.stamina);
    uiGold.textContent = gold;
    uiKills.textContent = kills;
    uiLevel.textContent = level;
    uiWeapon.textContent = player.weaponName;
    uiDmg.textContent = player.weaponDamage;
    uiArmor.textContent = player.armorName;
    uiDef.textContent = Math.round(player.armorDefense * 100);

    uiWeapon.className = player.weaponClass;
    uiArmor.className = player.armorClass;
    fitTopBarText();
}

function drawWorld() {
    const grd = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grd.addColorStop(0, "#2f4f3f");
    grd.addColorStop(0.55, "#263f35");
    grd.addColorStop(1, "#1c3030");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x < WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }

    ctx.fillStyle = "rgba(90, 130, 95, 0.5)";
    for (let i = 0; i < 18; i++) {
        const x = (i * 97) % WIDTH;
        const y = (i * 181) % HEIGHT;
        ctx.fillRect(x, y, 18, 3);
    }

    obstacles.forEach(o => {
        // Transparent scenery: objects are visible but see-through and non-colliding.
        ctx.save();
        ctx.globalAlpha = 0.38;
        if (o.type === "tree") {
            ctx.fillStyle = "#5d4037";
            ctx.fillRect(o.x + o.width / 2 - 8, o.y + 22, 16, o.height - 22);
            ctx.fillStyle = "#145a32";
            ctx.beginPath();
            ctx.arc(o.x + o.width / 2, o.y + 28, 35, 0, Math.PI * 2);
            ctx.fill();
        } else if (o.type === "ruin") {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(o.x, o.y, o.width, o.height);
            ctx.fillStyle = "#2c3e50";
            ctx.fillRect(o.x + 20, o.y + 28, 26, 44);
        } else if (o.type === "log") {
            ctx.fillStyle = "#6d4c41";
            ctx.fillRect(o.x, o.y, o.width, o.height);
            ctx.strokeStyle = "#3e2723";
            ctx.strokeRect(o.x, o.y, o.width, o.height);
        } else {
            ctx.fillStyle = "#6c7a89";
            ctx.fillRect(o.x, o.y, o.width, o.height);
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.fillRect(o.x + 8, o.y + 6, o.width - 16, 6);
        }
        ctx.restore();
    });
}

function drawCooldowns() {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(12, HEIGHT - 58, 220, 42);
    ctx.strokeStyle = "rgba(212,175,55,0.7)";
    ctx.strokeRect(12, HEIGHT - 58, 220, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Segoe UI";
    ctx.textAlign = "left";
    const shoutText = player.shoutCooldown <= 0 ? "Q Shout: Ready" : `Q Shout: ${player.shoutCooldown.toFixed(1)}s`;
    ctx.fillText(shoutText, 24, HEIGHT - 34);
}

function render() {
    ctx.save();
    // No camera shake: keeps the playfield stable and prevents visual jumping.

    drawWorld();
    potions.forEach(p => p.draw());
    chests.forEach(c => c.draw());
    lootItems.forEach(l => l.draw());
    enemies.forEach(e => e.draw());
    player.draw();

    ghostSouls.forEach(g => {
        const alpha = clamp(g.life / g.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = "rgba(230, 245, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.size * 0.45, Math.PI, 0);
        ctx.lineTo(g.x + g.size * 0.45, g.y + g.size * 0.45);
        ctx.quadraticCurveTo(g.x + g.size * 0.18, g.y + g.size * 0.28, g.x, g.y + g.size * 0.45);
        ctx.quadraticCurveTo(g.x - g.size * 0.18, g.y + g.size * 0.28, g.x - g.size * 0.45, g.y + g.size * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(30, 40, 55, 0.8)";
        ctx.fillRect(g.x - 5, g.y - 2, 3, 4);
        ctx.fillRect(g.x + 2, g.y - 2, 3, 4);
        ctx.restore();
    });

    particles.forEach(p => {
        ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
    });

    floatingTexts.forEach(t => {
        ctx.globalAlpha = clamp(t.life, 0, 1);
        ctx.fillStyle = t.color;
        ctx.font = "bold 14px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1;
    });

    drawCooldowns();
    ctx.restore();
}

function gameLoop(timestamp) {
    if (!gameActive) return;
    const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0.016);
    lastTime = timestamp;

    if (!paused) {
        updateGame(dt);
        render();
    }
    requestAnimationFrame(gameLoop);
}

function beginGameSession() {
    startBackgroundMusic();
    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    gameContainer.classList.remove("hidden");
    gameOverScreen.classList.remove("victory");

    enemies = [];
    lootItems = [];
    chests = [];
    potions = [];
    particles = [];
    floatingTexts = [];
    keys.clear();

    gold = 0;
    kills = 0;
    level = 1;
    enemyBaseSpeed = 70;
    bossSpawned = false;
    bossDefeated = false;
    paused = false;
    spawnClock = 0.6;
    chestClock = 5;
    potionClock = 10;
    lastTime = performance.now();

    generateWorld();
    player = new Dragonborn(WIDTH / 2 - 15, HEIGHT / 2 - 15);

    for (let i = 0; i < 5; i++) spawnLoot(1);
    updateUi();
    questLog.textContent = `Quest: Gather ${VICTORY_GOLD} gold. ${VICTORY_GOLD} gold remaining.`;
    showToast("The road to Whiterun is dangerous.");

    gameActive = true;
    requestAnimationFrame(gameLoop);
}

function endGame(isVictory) {
    gameActive = false;
    gameContainer.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    gameOverScreen.classList.remove("hidden");
    uiFinalGold.textContent = gold;
    uiFinalKills.textContent = kills;

    if (isVictory) {
        gameOverScreen.classList.add("victory");
        endTitle.textContent = "VICTORY!";
        endMessage.textContent = "You gathered the gold, defeated the Dragon Priest, and saved the hold.";
    } else {
        gameOverScreen.classList.remove("victory");
        endTitle.textContent = "You Have Fallen...";
        endMessage.textContent = "Bandits, wraiths, and dragons overran the road.";
    }
}

function togglePause() {
    if (!gameActive) return;
    paused = !paused;
    pauseScreen.classList.toggle("hidden", !paused);
    if (!paused) {
        lastTime = performance.now();
    }
}

window.addEventListener("keydown", e => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(e.code)) {
        e.preventDefault();
    }

    if (e.code === "KeyP") {
        togglePause();
        return;
    }

    if (e.code === "KeyM") {
        muted = !muted;
        showToast(muted ? "Muted." : "Sound on.");
        return;
    }

    keys.add(e.code);

    if (!gameActive || paused || !player) return;
    if (e.code === "Space") player.attack();
    if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && !e.repeat) player.dash();
    if (e.code === "KeyQ") player.shout();
    if (e.code === "KeyE") openNearbyChest();
});

window.addEventListener("keyup", e => {
    keys.delete(e.code);
});

canvas.addEventListener("mousedown", () => {
    if (gameActive && !paused && player) player.attack();
});

startBtn.addEventListener("click", beginGameSession);
restartBtn.addEventListener("click", beginGameSession);
