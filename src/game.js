import { STATE, CONFIG } from "./constants.js";
import { Grid } from "./grid.js";
import { Track } from "./track.js";
import { Player } from "./player.js";
import { Renderer } from "./renderer.js";

class Game {
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        this.grid = new Grid();
        this.track = new Track();
        this.renderer = new Renderer(this.canvas, this.grid);

        this.state = {
            mode: STATE.DRAWING,
            players: [],
            currentPlayerIdx: 0,
            drawnPath: [], // Raw world points
            isDrawing: false,
            isPanning: false,
            lastPanPos: null,
            inputStartPos: null,
        };

        this.init();
    }

    init() {
        this.renderer.resize();
        window.addEventListener("resize", () => {
            this.renderer.resize();
            this.draw();
        });

        this.setupInputs();
        this.setupUI();

        // Start loop
        const loop = () => {
            requestAnimationFrame(loop);
            // Animation logic if needed
        };
        loop();

        this.draw();
    }

    setupUI() {
        // Top Bar
        document.getElementById("finish-drawing-btn").onclick = () =>
            this.finishDrawing();
        document.getElementById("clear-track-btn").onclick = () =>
            this.resetTrack();
        document.getElementById("add-player-btn").onclick = () =>
            this.addPlayer();
        document.getElementById("start-race-btn").onclick = () =>
            this.startRace();

        // Common Controls
        document.getElementById("print-btn").onclick = () => {
            window.print();
        };

        // Settings
        document.getElementById("show-grid-chk").onchange = () => this.draw();
        document.getElementById("grid-size-slider").oninput = (e) => {
            CONFIG.gridSize = parseInt(e.target.value);
            this.grid.setSize(CONFIG.gridSize);
            this.draw();
        };
        document.getElementById("track-width-slider").oninput = (e) => {
            CONFIG.trackWidth = parseInt(e.target.value);
            if (this.state.drawnPath.length > 0) {
                this.track.generate(this.state.drawnPath, CONFIG.trackWidth);
            }
            this.draw();
        };

        // Camera
        document.getElementById("zoom-in-btn").onclick = () => this.zoom(1.2);
        document.getElementById("zoom-out-btn").onclick = () => this.zoom(0.8);
        document.getElementById("center-view-btn").onclick = () =>
            this.centerView();
    }

    setupInputs() {
        this.canvas.addEventListener("mousedown", (e) =>
            this.handleInputStart(e)
        );
        this.canvas.addEventListener("mousemove", (e) =>
            this.handleInputMove(e)
        );
        this.canvas.addEventListener("mouseup", (e) => this.handleInputEnd(e));
        this.canvas.addEventListener("mouseleave", (e) =>
            this.handleInputEnd(e)
        );
        this.canvas.addEventListener("wheel", (e) => this.handleWheel(e));

        // Touch support omitted for brevity but follows same pattern
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    }

    screenToWorld(screenPos) {
        const cam = this.renderer.camera;
        return {
            x: (screenPos.x - cam.x) / cam.zoom,
            y: (screenPos.y - cam.y) / cam.zoom,
        };
    }

    handleWheel(e) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(factor, this.getMousePos(e));
    }

    zoom(factor, centerScreen) {
        if (!centerScreen) {
            centerScreen = {
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
            };
        }

        const cam = this.renderer.camera;
        const newZoom = Math.max(
            CONFIG.minZoom,
            Math.min(CONFIG.maxZoom, cam.zoom * factor)
        );

        // Adjust offset to zoom towards center
        // world = (screen - cam) / zoom
        // screen = world * zoom + cam
        // We want world point under mouse to stay at same screen pos
        // world = (centerScreen - oldCam) / oldZoom
        // newCam = centerScreen - world * newZoom

        const world = {
            x: (centerScreen.x - cam.x) / cam.zoom,
            y: (centerScreen.y - cam.y) / cam.zoom,
        };

        const newX = centerScreen.x - world.x * newZoom;
        const newY = centerScreen.y - world.y * newZoom;

        this.renderer.setCamera(newX, newY, newZoom);
        this.draw();
    }

    handleInputStart(e) {
        const screenPos = this.getMousePos(e);
        const worldPos = this.screenToWorld(screenPos);

        this.state.inputStartPos = screenPos;
        this.state.isPanning = false;

        if (this.state.mode === STATE.DRAWING) {
            this.state.isDrawing = true;
            this.state.drawnPath = [worldPos];
        }
    }

    handleInputMove(e) {
        const screenPos = this.getMousePos(e);
        const worldPos = this.screenToWorld(screenPos);

        // Pan detection
        if (
            this.state.inputStartPos &&
            !this.state.isPanning &&
            this.state.mode !== STATE.DRAWING
        ) {
            const dist = Math.hypot(
                screenPos.x - this.state.inputStartPos.x,
                screenPos.y - this.state.inputStartPos.y
            );
            if (dist > 5) {
                this.state.isPanning = true;
                this.state.lastPanPos = screenPos;
            }
        }

        if (this.state.isPanning) {
            const dx = screenPos.x - this.state.lastPanPos.x;
            const dy = screenPos.y - this.state.lastPanPos.y;
            const cam = this.renderer.camera;
            this.renderer.setCamera(cam.x + dx, cam.y + dy, cam.zoom);
            this.state.lastPanPos = screenPos;
            this.draw();
            return;
        }

        if (this.state.mode === STATE.DRAWING && this.state.isDrawing) {
            const lastPt =
                this.state.drawnPath[this.state.drawnPath.length - 1];
            const dist = Math.hypot(
                worldPos.x - lastPt.x,
                worldPos.y - lastPt.y
            );
            if (dist > 5) {
                this.state.drawnPath.push(worldPos);
                this.draw();
            }
        }
    }

    handleInputEnd(e) {
        this.state.inputStartPos = null;

        if (this.state.isPanning) {
            this.state.isPanning = false;
            return;
        }

        if (this.state.mode === STATE.RACING && e) {
            const screenPos = this.getMousePos(e);
            const worldPos = this.screenToWorld(screenPos);
            this.handleRaceClick(worldPos);
        }

        this.state.isDrawing = false;
    }

    // --- Game Logic ---

    finishDrawing() {
        if (this.state.drawnPath.length < 5) {
            alert("Track too short!");
            return;
        }

        this.track.generate(this.state.drawnPath, CONFIG.trackWidth);

        // Calculate start point and direction
        const path = this.state.drawnPath;
        const idx = Math.min(5, path.length - 1);
        const startRaw = path[idx];

        // Direction
        let dx = 0,
            dy = 0;
        const lookAhead = Math.min(20, path.length - 1);
        for (let i = 0; i < lookAhead; i++) {
            dx += path[i + 1].x - path[i].x;
            dy += path[i + 1].y - path[i].y;
        }
        const len = Math.sqrt(dx * dx + dy * dy);
        const dir = { x: dx / len, y: dy / len };

        this.track.setStartLine(this.grid, startRaw, dir);

        this.setMode(STATE.SETUP);
        this.centerView();
    }

    resetTrack() {
        this.state.drawnPath = [];
        this.track = new Track();
        this.draw();
    }

    addPlayer() {
        const input = document.getElementById("player-name-input");
        const name = input.value.trim();
        if (!name) return;

        const color =
            CONFIG.colors[this.state.players.length % CONFIG.colors.length];
        const player = new Player(name, color, this.track.startPoint);
        this.state.players.push(player);

        input.value = "";
        this.updatePlayerUI();
        document.getElementById("start-race-btn").disabled = false;
        this.draw();
    }

    startRace() {
        this.setMode(STATE.RACING);
        this.updatePlayerUI();
    }

    handleRaceClick(worldPos) {
        const player = this.state.players[this.state.currentPlayerIdx];
        const clickedGridPos = this.grid.toGrid(worldPos.x, worldPos.y);

        const validMoves = player.getValidMoves();
        const move = validMoves.find(
            (m) => m.x === clickedGridPos.x && m.y === clickedGridPos.y
        );

        if (move) {
            this.executeMove(player, move);
        }
    }

    executeMove(player, targetGridPos) {
        // Check collision
        // We need to check if the line from current center to target center stays on track
        const currentWorld = this.grid.toWorld(
            player.gridPos.x,
            player.gridPos.y
        );
        const targetWorld = this.grid.toWorld(targetGridPos.x, targetGridPos.y);

        // Check if target is on track
        const isTargetOnTrack = this.track.isPointOnTrack(
            this.renderer.ctx,
            targetWorld.x,
            targetWorld.y
        );

        // We could also check intermediate points for better collision

        if (!isTargetOnTrack) {
            alert(`CRASH! ${player.name} went off track! Moving back 2 turns.`);
            player.crash();
        } else {
            // Check Lap
            if (this.track.checkLap(currentWorld, targetWorld)) {
                this.setMode(STATE.FINISHED);
                const indicator = document.getElementById("turn-indicator");
                indicator.textContent = `🏆 ${player.name} WINS! 🏆`;
                indicator.style.color = player.color;
                player.move(targetGridPos); // Final move
                this.draw();
                return;
            }

            player.move(targetGridPos);
        }

        this.state.currentPlayerIdx =
            (this.state.currentPlayerIdx + 1) % this.state.players.length;
        this.updatePlayerUI();
        this.draw();
    }

    setMode(mode) {
        this.state.mode = mode;

        document.getElementById("controls-stage-1").classList.add("hidden");
        document.getElementById("controls-stage-2").classList.add("hidden");
        document.getElementById("controls-stage-3").classList.add("hidden");
        document.getElementById("player-bar").classList.add("hidden");

        if (mode === STATE.DRAWING) {
            document
                .getElementById("controls-stage-1")
                .classList.remove("hidden");
        } else if (mode === STATE.SETUP) {
            document
                .getElementById("controls-stage-2")
                .classList.remove("hidden");
            document.getElementById("player-bar").classList.remove("hidden");
        } else if (mode === STATE.RACING || mode === STATE.FINISHED) {
            document
                .getElementById("controls-stage-3")
                .classList.remove("hidden");
            document.getElementById("player-bar").classList.remove("hidden");
        }
        this.draw();
    }

    updatePlayerUI() {
        const list = document.getElementById("player-bar");
        list.innerHTML = this.state.players
            .map((p, idx) => {
                const isActive =
                    this.state.mode === STATE.RACING &&
                    idx === this.state.currentPlayerIdx;
                const activeStyle = isActive
                    ? `border-color: ${p.color}; background-color: ${p.color}20; color: ${p.color};`
                    : "";
                return `
            <div class="player-chip ${
                isActive ? "active" : ""
            }" style="${activeStyle}">
                <div class="player-dot" style="background:${p.color}"></div>
                ${p.name}
            </div>
            `;
            })
            .join("");

        if (this.state.mode === STATE.RACING) {
            const p = this.state.players[this.state.currentPlayerIdx];
            const indicator = document.getElementById("turn-indicator");
            indicator.textContent = `${p.name}'s Turn`;
            indicator.style.color = p.color;
        }
    }

    resetGame() {
        this.state.players = [];
        this.state.currentPlayerIdx = 0;
        this.state.drawnPath = [];
        this.track = new Track();
        this.setMode(STATE.DRAWING);
        document.getElementById("start-race-btn").disabled = true;
        this.centerView();
    }

    centerView() {
        if (this.state.drawnPath.length === 0) {
            this.renderer.setCamera(0, 0, 1);
            this.draw();
            return;
        }

        // Bounds
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const p of this.state.drawnPath) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        const padding = CONFIG.trackWidth + 100;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        const zoom = Math.min(
            this.canvas.width / width,
            this.canvas.height / height,
            1.5
        );

        const camX = this.canvas.width / 2 - cx * zoom;
        const camY = this.canvas.height / 2 - cy * zoom;

        this.renderer.setCamera(camX, camY, zoom);
        this.draw();
    }

    draw() {
        this.renderer.beginFrame();

        this.renderer.drawTrack(this.track);

        if (this.state.mode === STATE.DRAWING) {
            this.renderer.drawPreviewPath(this.state.drawnPath);
        }

        if (document.getElementById("show-grid-chk").checked) {
            this.renderer.drawGridLines();
        }

        this.state.players.forEach((p, idx) => {
            const isActive =
                this.state.mode === STATE.RACING &&
                idx === this.state.currentPlayerIdx;
            this.renderer.drawPlayer(p, isActive);
        });

        if (this.state.mode === STATE.RACING) {
            const player = this.state.players[this.state.currentPlayerIdx];
            const moves = player.getValidMoves();
            this.renderer.drawValidMoves(player, moves);
        }

        this.renderer.endFrame();
    }
}

new Game();
