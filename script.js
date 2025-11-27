const STATE = {
    DRAWING: "DRAWING",
    SETUP: "SETUP",
    RACING: "RACING",
    FINISHED: "FINISHED",
};

const CONFIG = {
    gridSize: 20,
    trackWidth: 80, // Width of the playable track
    borderWidth: 4, // Width of the border edge
    colors: ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
};

let gameState = {
    mode: STATE.DRAWING,
    drawnPath: [], // Array of {x, y}
    trackPath2D: null, // Path2D object for the track center line
    startPoint: null,
    endPoint: null,
    players: [],
    currentPlayerIdx: 0,
    isDrawing: false,
};

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

// --- Initialization ---

function init() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    setupEventListeners();
    gameLoop();
}

function resizeCanvas() {
    // Make canvas large but fit within the container with some padding
    const container = document.querySelector(".canvas-container");
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;

    // Snap to grid size
    canvas.width = Math.floor(maxWidth / CONFIG.gridSize) * CONFIG.gridSize;
    canvas.height = Math.floor(maxHeight / CONFIG.gridSize) * CONFIG.gridSize;

    draw();
}

function setupEventListeners() {
    // Canvas Input
    canvas.addEventListener("mousedown", handleInputStart);
    canvas.addEventListener("mousemove", handleInputMove);
    canvas.addEventListener("mouseup", handleInputEnd);
    canvas.addEventListener("mouseleave", handleInputEnd);

    // Touch support
    canvas.addEventListener(
        "touchstart",
        (e) => {
            e.preventDefault();
            handleInputStart(e.touches[0]);
        },
        { passive: false }
    );
    canvas.addEventListener(
        "touchmove",
        (e) => {
            e.preventDefault();
            handleInputMove(e.touches[0]);
        },
        { passive: false }
    );
    canvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        handleInputEnd();
    });

    // UI Controls
    document.getElementById("finish-drawing-btn").onclick = finishDrawing;
    document.getElementById("clear-track-btn").onclick = resetTrack;
    document.getElementById("add-player-btn").onclick = addPlayer;
    document.getElementById("start-race-btn").onclick = startRace;
    document.getElementById("reset-game-btn").onclick = resetGame;
    document.getElementById("print-btn").onclick = () => window.print();
    document.getElementById("show-grid-chk").onchange = () => draw();
}

// --- Input Handling ---

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    // Scale in case canvas is styled differently
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY,
    };
}

function handleInputStart(e) {
    const pos = getMousePos(e);
    if (gameState.mode === STATE.DRAWING) {
        gameState.isDrawing = true;
        gameState.drawnPath = [pos];
    } else if (gameState.mode === STATE.RACING) {
        handleRaceClick(pos);
    }
}

function handleInputMove(e) {
    const pos = getMousePos(e);
    if (gameState.mode === STATE.DRAWING && gameState.isDrawing) {
        // Add point if distance is sufficient (smoothing)
        const lastPt = gameState.drawnPath[gameState.drawnPath.length - 1];
        const dist = Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y);
        if (dist > 5) {
            gameState.drawnPath.push(pos);
            draw();
        }
    }
}

function handleInputEnd() {
    gameState.isDrawing = false;
}

// --- Stage 1: Drawing & Track Generation ---

function finishDrawing() {
    if (gameState.drawnPath.length < 5) {
        alert("Track is too short!");
        return;
    }

    // Create Path2D for the track
    gameState.trackPath2D = new Path2D();
    gameState.trackPath2D.moveTo(
        gameState.drawnPath[0].x,
        gameState.drawnPath[0].y
    );
    for (let i = 1; i < gameState.drawnPath.length; i++) {
        gameState.trackPath2D.lineTo(
            gameState.drawnPath[i].x,
            gameState.drawnPath[i].y
        );
    }

    placeStartEndPoints();
    setMode(STATE.SETUP);
}

function resetTrack() {
    gameState.drawnPath = [];
    gameState.trackPath2D = null;
    draw();
}

function placeStartEndPoints() {
    // Place start near beginning, end near end
    // Snap to grid
    const path = gameState.drawnPath;
    const startRaw = path[Math.floor(path.length * 0.05)];
    const endRaw = path[Math.floor(path.length * 0.95)];

    gameState.startPoint = snapToGrid(startRaw);
    gameState.endPoint = snapToGrid(endRaw);
}

// --- Stage 2: Setup ---

function addPlayer() {
    const input = document.getElementById("player-name-input");
    const name = input.value.trim();
    if (!name) return;

    const color =
        CONFIG.colors[gameState.players.length % CONFIG.colors.length];
    gameState.players.push({
        name,
        color,
        pos: { ...gameState.startPoint },
        vel: { x: 0, y: 0 },
        history: [{ ...gameState.startPoint }],
        crashed: false,
    });

    input.value = "";
    updatePlayerUI();
    document.getElementById("start-race-btn").disabled = false;
    draw();
}

function startRace() {
    setMode(STATE.RACING);
    updatePlayerUI();
}

// --- Stage 3: Racing ---

function handleRaceClick(mousePos) {
    const player = gameState.players[gameState.currentPlayerIdx];
    const gridPos = snapToGrid(mousePos);
    const validMoves = getValidMoves(player);

    const move = validMoves.find((m) => m.x === gridPos.x && m.y === gridPos.y);

    if (move) {
        executeMove(player, move);
    }
}

function getValidMoves(player) {
    const inertiaX = player.pos.x + player.vel.x;
    const inertiaY = player.pos.y + player.vel.y;
    const moves = [];

    for (
        let dx = -CONFIG.gridSize;
        dx <= CONFIG.gridSize;
        dx += CONFIG.gridSize
    ) {
        for (
            let dy = -CONFIG.gridSize;
            dy <= CONFIG.gridSize;
            dy += CONFIG.gridSize
        ) {
            moves.push({ x: inertiaX + dx, y: inertiaY + dy });
        }
    }
    return moves;
}

function executeMove(player, targetPos) {
    // Check collision
    if (!isMoveValid(player.pos, targetPos)) {
        // Crash!
        alert(`CRASH! ${player.name} went off track! Resetting velocity.`);
        player.vel = { x: 0, y: 0 };
        // Position stays same, turn ends.
    } else {
        const newVel = {
            x: targetPos.x - player.pos.x,
            y: targetPos.y - player.pos.y,
        };
        player.pos = targetPos;
        player.vel = newVel;
        player.history.push({ ...targetPos });

        if (checkWin(player.pos)) {
            setMode(STATE.FINISHED);
            document.getElementById(
                "turn-indicator"
            ).textContent = `🏆 ${player.name} WINS! 🏆`;
            document.getElementById("turn-indicator").style.color =
                player.color;
            draw();
            return;
        }
    }

    gameState.currentPlayerIdx =
        (gameState.currentPlayerIdx + 1) % gameState.players.length;
    updatePlayerUI();
    draw();
}

function isMoveValid(p1, p2) {
    // Check if point p2 is on the track
    // We use isPointInStroke on the trackPath2D with the track width
    if (!gameState.trackPath2D) return false;

    ctx.save();
    ctx.lineWidth = CONFIG.trackWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const inside = ctx.isPointInStroke(gameState.trackPath2D, p2.x, p2.y);
    ctx.restore();

    return inside;
}

function checkWin(pos) {
    const dist = Math.hypot(
        pos.x - gameState.endPoint.x,
        pos.y - gameState.endPoint.y
    );
    return dist < CONFIG.gridSize * 1.5;
}

// --- Helpers ---

function snapToGrid(pos) {
    return {
        x: Math.round(pos.x / CONFIG.gridSize) * CONFIG.gridSize,
        y: Math.round(pos.y / CONFIG.gridSize) * CONFIG.gridSize,
    };
}

function setMode(mode) {
    gameState.mode = mode;

    // UI Visibility
    document.getElementById("controls-stage-1").classList.add("hidden");
    document.getElementById("controls-stage-2").classList.add("hidden");
    document.getElementById("controls-stage-3").classList.add("hidden");
    document.getElementById("player-bar").classList.add("hidden");

    if (mode === STATE.DRAWING) {
        document.getElementById("controls-stage-1").classList.remove("hidden");
    } else if (mode === STATE.SETUP) {
        document.getElementById("controls-stage-2").classList.remove("hidden");
        document.getElementById("player-bar").classList.remove("hidden");
    } else if (mode === STATE.RACING || mode === STATE.FINISHED) {
        document.getElementById("controls-stage-3").classList.remove("hidden");
        document.getElementById("player-bar").classList.remove("hidden");
    }

    draw();
}

function updatePlayerUI() {
    const list = document.getElementById("player-bar");
    list.innerHTML = gameState.players
        .map((p, idx) => {
            const isActive =
                gameState.mode === STATE.RACING &&
                idx === gameState.currentPlayerIdx;
            return `
            <div class="player-chip ${isActive ? "active" : ""}">
                <div class="player-dot" style="background:${p.color}"></div>
                ${p.name}
            </div>
        `;
        })
        .join("");

    if (gameState.mode === STATE.RACING) {
        const p = gameState.players[gameState.currentPlayerIdx];
        const indicator = document.getElementById("turn-indicator");
        indicator.textContent = `${p.name}'s Turn`;
        indicator.style.color = p.color;
    }
}

function resetGame() {
    gameState = {
        mode: STATE.DRAWING,
        drawnPath: [],
        trackPath2D: null,
        startPoint: null,
        endPoint: null,
        players: [],
        currentPlayerIdx: 0,
        isDrawing: false,
    };
    document.getElementById("start-race-btn").disabled = true;
    setMode(STATE.DRAWING);
}

// --- Drawing ---

function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    if (document.getElementById("show-grid-chk").checked) {
        drawGrid();
    }

    // Track
    if (gameState.trackPath2D) {
        // Draw Border (Thick line)
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.lineWidth = CONFIG.trackWidth + CONFIG.borderWidth * 2;
        ctx.strokeStyle = "#94a3b8"; // Border color
        ctx.stroke(gameState.trackPath2D);

        // Draw Surface (Slightly thinner line)
        ctx.lineWidth = CONFIG.trackWidth;
        ctx.strokeStyle = "#ffffff"; // Track surface color
        ctx.stroke(gameState.trackPath2D);
    } else if (gameState.drawnPath.length > 0) {
        // Drawing phase preview
        ctx.beginPath();
        ctx.moveTo(gameState.drawnPath[0].x, gameState.drawnPath[0].y);
        for (let p of gameState.drawnPath) ctx.lineTo(p.x, p.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2563eb";
        ctx.stroke();
    }

    // Start/End
    if (gameState.startPoint)
        drawMarker(gameState.startPoint, "START", "#10b981");
    if (gameState.endPoint) drawMarker(gameState.endPoint, "FINISH", "#ef4444");

    // Players
    gameState.players.forEach((p) => drawPlayer(p));

    // Valid Moves
    if (gameState.mode === STATE.RACING) {
        drawValidMoves(gameState.players[gameState.currentPlayerIdx]);
    }
}

function drawGrid() {
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += CONFIG.gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += CONFIG.gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
}

function drawMarker(pos, text, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, pos.x, pos.y - 10);
}

function drawPlayer(p) {
    // History
    if (p.history.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.history[0].x, p.history[0].y);
        for (let pt of p.history) ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    // Current
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function drawValidMoves(player) {
    const moves = getValidMoves(player);
    const inertiaX = player.pos.x + player.vel.x;
    const inertiaY = player.pos.y + player.vel.y;

    // Inertia Line
    ctx.beginPath();
    ctx.moveTo(player.pos.x, player.pos.y);
    ctx.lineTo(inertiaX, inertiaY);
    ctx.strokeStyle = player.color;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dots
    ctx.fillStyle = player.color;
    ctx.globalAlpha = 0.4;
    moves.forEach((m) => {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    requestAnimationFrame(gameLoop);
}

window.onload = init;
