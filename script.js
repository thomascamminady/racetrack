const STATE = {
    DRAWING: "DRAWING",
    SETUP: "SETUP",
    RACING: "RACING",
    FINISHED: "FINISHED",
};

const CONFIG = {
    gridSize: 30, // Default, mutable
    trackWidth: 80,
    borderWidth: 4,
    colors: ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
};

let gameState = {
    mode: STATE.DRAWING,
    drawnPath: [],
    trackPath2D: null,
    trackLength: 0,
    startPoint: null,
    startAngle: 0,
    players: [],
    currentPlayerIdx: 0,
    isDrawing: false,
    camera: { x: 0, y: 0, zoom: 1 },
    isPanning: false,
    lastPanPos: { x: 0, y: 0 },
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

    // Menu Controls
    const menuBtn = document.getElementById("menu-toggle-btn");
    const menu = document.getElementById("main-menu");

    menuBtn.onclick = (e) => {
        e.stopPropagation();
        menu.classList.toggle("hidden");
    };

    document.addEventListener("click", (e) => {
        if (menu && !menu.contains(e.target) && e.target !== menuBtn) {
            menu.classList.add("hidden");
        }
    });

    document.getElementById("reset-game-btn").onclick = () => {
        resetGame();
        menu.classList.add("hidden");
    };
    document.getElementById("print-btn").onclick = () => {
        window.print();
        menu.classList.add("hidden");
    };
    document.getElementById("show-grid-chk").onchange = () => draw();
    document.getElementById("grid-size-select").onchange = (e) => {
        CONFIG.gridSize = parseInt(e.target.value);
        draw();
    };
    document.getElementById("track-width-slider").oninput = (e) => {
        CONFIG.trackWidth = parseInt(e.target.value);
        if (gameState.drawnPath.length > 0) {
            // Re-generate track path if we have a drawn path
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
        }
        draw();
    };

    // Bottom Controls
    document.getElementById("zoom-in-btn").onclick = () => zoom(1.2);
    document.getElementById("zoom-out-btn").onclick = () => zoom(0.8);
    document.getElementById("center-view-btn").onclick = centerView;
}

// --- Input Handling & Camera ---

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
    };
}

function toWorld(screenPos) {
    return {
        x: (screenPos.x - gameState.camera.x) / gameState.camera.zoom,
        y: (screenPos.y - gameState.camera.y) / gameState.camera.zoom,
    };
}

function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoom(zoomFactor, getMousePos(e));
}

function zoom(factor, center) {
    if (!center) {
        const rect = canvas.getBoundingClientRect();
        center = { x: rect.width / 2, y: rect.height / 2 };
    }

    const newZoom = Math.max(0.1, Math.min(5, gameState.camera.zoom * factor));

    // Adjust offset to zoom towards center
    gameState.camera.x =
        center.x -
        (center.x - gameState.camera.x) * (newZoom / gameState.camera.zoom);
    gameState.camera.y =
        center.y -
        (center.y - gameState.camera.y) * (newZoom / gameState.camera.zoom);
    gameState.camera.zoom = newZoom;

    draw();
}

function centerView() {
    if (!gameState.drawnPath || gameState.drawnPath.length === 0) {
        gameState.camera = { x: 0, y: 0, zoom: 1 };
        draw();
        return;
    }

    // Calculate bounding box
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const p of gameState.drawnPath) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    // Add padding (track width + border + extra)
    const padding = CONFIG.trackWidth + 100;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    // Canvas dimensions
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // Calculate zoom to fit
    const zoomX = canvasW / contentWidth;
    const zoomY = canvasH / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, 1.5); // Don't zoom in too much

    // Center camera
    // Camera transform: screen = (world * zoom) + cam
    // cam = screen - (world * zoom)
    // We want contentCenter to be at canvas center

    gameState.camera.zoom = newZoom;
    gameState.camera.x = canvasW / 2 - contentCenterX * newZoom;
    gameState.camera.y = canvasH / 2 - contentCenterY * newZoom;

    draw();
}

function handleInputStart(e) {
    const screenPos = getMousePos(e);
    const worldPos = toWorld(screenPos);

    gameState.inputStartPos = screenPos;
    gameState.isPanning = false; // Reset, wait for move to confirm pan

    if (gameState.mode === STATE.DRAWING) {
        gameState.isDrawing = true;
        gameState.drawnPath = [worldPos];
    }
}

function handleInputMove(e) {
    const screenPos = getMousePos(e);
    const worldPos = toWorld(screenPos);

    // Check for drag/pan threshold
    if (
        gameState.inputStartPos &&
        !gameState.isPanning &&
        gameState.mode !== STATE.DRAWING
    ) {
        const dist = Math.hypot(
            screenPos.x - gameState.inputStartPos.x,
            screenPos.y - gameState.inputStartPos.y
        );
        if (dist > 5) {
            gameState.isPanning = true;
            gameState.lastPanPos = screenPos; // Start panning from here to avoid jump
        }
    }

    if (gameState.isPanning) {
        const dx = screenPos.x - gameState.lastPanPos.x;
        const dy = screenPos.y - gameState.lastPanPos.y;
        gameState.camera.x += dx;
        gameState.camera.y += dy;
        gameState.lastPanPos = screenPos;
        draw();
        return;
    }

    if (gameState.mode === STATE.DRAWING && gameState.isDrawing) {
        const lastPt = gameState.drawnPath[gameState.drawnPath.length - 1];
        const dist = Math.hypot(worldPos.x - lastPt.x, worldPos.y - lastPt.y);
        if (dist > 5) {
            gameState.drawnPath.push(worldPos);
            draw();
        }
    }
}

function handleInputEnd(e) {
    gameState.inputStartPos = null;

    if (gameState.isPanning) {
        gameState.isPanning = false;
        return; // It was a drag, not a click
    }

    if (gameState.mode === STATE.RACING && e) {
        // Handle click for move
        const screenPos = getMousePos(e);
        const worldPos = toWorld(screenPos);
        handleRaceClick(worldPos);
    }

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
    // Place start near beginning
    const path = gameState.drawnPath;
    if (path.length < 10) return;

    // Use index 5 or so to get a stable direction
    const idx = Math.min(5, path.length - 1);
    const startRaw = path[idx];

    // Calculate direction
    // Average vector of first few points
    let dx = 0,
        dy = 0;
    const lookAhead = Math.min(20, path.length - 1);
    for (let i = 0; i < lookAhead; i++) {
        dx += path[i + 1].x - path[i].x;
        dy += path[i + 1].y - path[i].y;
    }
    const len = Math.sqrt(dx * dx + dy * dy);
    const dir = { x: dx / len, y: dy / len };

    gameState.startPoint = snapToGrid(startRaw);
    gameState.startDir = dir;

    // Define start line perpendicular to direction
    // Width of track is CONFIG.trackWidth
    // Line segment: center +/- perpendicular * width/2
    const perp = { x: -dir.y, y: dir.x };
    // Cover full visual width (track + borders)
    const halfWidth = (CONFIG.trackWidth + CONFIG.borderWidth * 2) / 2;

    // Use startRaw (point on path) for line center, not snapped startPoint
    const lineCenter = startRaw;

    gameState.startLine = {
        p1: {
            x: lineCenter.x + perp.x * halfWidth,
            y: lineCenter.y + perp.y * halfWidth,
        },
        p2: {
            x: lineCenter.x - perp.x * halfWidth,
            y: lineCenter.y - perp.y * halfWidth,
        },
    };
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
        lap: 0,
        progress: 0, // 0 to 1 along track
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
        alert(`CRASH! ${player.name} went off track! Moving back 2 turns.`);

        // Back 2 turns logic
        // history has [start, m1, m2, ... current]
        // We want to go back to m(current-2)

        // If we have enough history
        if (player.history.length > 2) {
            player.history.pop(); // Remove current
            player.history.pop(); // Remove previous
            const newPos = player.history[player.history.length - 1];
            player.pos = { ...newPos };
        } else {
            // Reset to start
            const start = player.history[0];
            player.history = [{ ...start }];
            player.pos = { ...start };
        }

        player.vel = { x: 0, y: 0 };
        // Turn ends
    } else {
        const newVel = {
            x: targetPos.x - player.pos.x,
            y: targetPos.y - player.pos.y,
        };
        player.pos = targetPos;
        player.vel = newVel;
        player.history.push({ ...targetPos });

        if (checkWin(player)) {
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

function checkWin(player) {
    if (player.history.length < 5) return false; // Too early

    const prev = player.history[player.history.length - 2];
    const curr = player.pos;

    // Check intersection with startLine
    if (
        gameState.startLine &&
        segmentsIntersect(
            prev,
            curr,
            gameState.startLine.p1,
            gameState.startLine.p2
        )
    ) {
        // Check direction
        const moveDir = { x: curr.x - prev.x, y: curr.y - prev.y };
        const dot =
            moveDir.x * gameState.startDir.x + moveDir.y * gameState.startDir.y;
        if (dot > 0) {
            return true; // Lap complete!
        }
    }
    return false;
}

function segmentsIntersect(a, b, c, d) {
    const det = (b.x - a.x) * (d.y - c.y) - (d.x - c.x) * (b.y - a.y);
    if (det === 0) return false;
    const lambda =
        ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
    const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
    return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
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
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    // Apply Camera
    ctx.translate(gameState.camera.x, gameState.camera.y);
    ctx.scale(gameState.camera.zoom, gameState.camera.zoom);

    // Track (Draw first so grid is on top)
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

        // Start Line
        if (gameState.startLine) {
            // Draw Line
            ctx.beginPath();
            ctx.moveTo(gameState.startLine.p1.x, gameState.startLine.p1.y);
            ctx.lineTo(gameState.startLine.p2.x, gameState.startLine.p2.y);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 4;
            ctx.stroke();

            // Draw Direction Arrow
            if (gameState.startDir) {
                const center = gameState.startPoint;
                const dir = gameState.startDir;
                const arrowLen = 40;
                const arrowEnd = {
                    x: center.x + dir.x * arrowLen,
                    y: center.y + dir.y * arrowLen,
                };

                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(arrowEnd.x, arrowEnd.y);

                // Arrowhead
                const angle = Math.atan2(dir.y, dir.x);
                ctx.lineTo(
                    arrowEnd.x - 10 * Math.cos(angle - Math.PI / 6),
                    arrowEnd.y - 10 * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(arrowEnd.x, arrowEnd.y);
                ctx.lineTo(
                    arrowEnd.x - 10 * Math.cos(angle + Math.PI / 6),
                    arrowEnd.y - 10 * Math.sin(angle + Math.PI / 6)
                );

                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    } else if (gameState.drawnPath.length > 0) {
        // Drawing phase preview
        ctx.beginPath();
        ctx.moveTo(gameState.drawnPath[0].x, gameState.drawnPath[0].y);
        for (let p of gameState.drawnPath) ctx.lineTo(p.x, p.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2563eb";
        ctx.stroke();
    }

    // Grid (Draw AFTER track so it's visible on top)
    if (document.getElementById("show-grid-chk").checked) {
        drawGrid();
    }

    // Players
    gameState.players.forEach((p, idx) => {
        const isActive =
            gameState.mode === STATE.RACING &&
            idx === gameState.currentPlayerIdx;
        drawPlayer(p, isActive);
    });

    // Valid Moves
    if (gameState.mode === STATE.RACING) {
        drawValidMoves(gameState.players[gameState.currentPlayerIdx]);
    }

    ctx.restore();
}

function drawGrid() {
    // We need to draw grid lines that cover the visible area or the whole world?
    // Drawing infinite grid is tricky with transform.
    // Let's draw a large enough grid around the track or just the canvas area transformed.
    // Simplest: Draw grid based on world coordinates covering the canvas view.

    // Get visible world bounds
    // But simpler: just draw a huge grid from -5000 to 5000?
    // Or just draw grid on the canvas area but mapped to world?

    const startX = -2000;
    const endX = 4000;
    const startY = -2000;
    const endY = 4000;

    // Offset grid by half size so intersections are in the center of squares
    const offset = CONFIG.gridSize / 2;

    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)"; // Very light black
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += CONFIG.gridSize) {
        ctx.moveTo(x + offset, startY);
        ctx.lineTo(x + offset, endY);
    }
    for (let y = startY; y <= endY; y += CONFIG.gridSize) {
        ctx.moveTo(startX, y + offset);
        ctx.lineTo(endX, y + offset);
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

function drawPlayer(p, isActive) {
    // History
    if (p.history.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.history[0].x, p.history[0].y);
        for (let pt of p.history) ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Active Player Highlight
    if (isActive) {
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, 10, 0, Math.PI * 2);
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

    // Dots (Full Cells)
    moves.forEach((m) => {
        // Draw full grid cell
        // Grid point is center or corner?
        // snapToGrid rounds to nearest grid size. So m.x, m.y is the center/intersection.
        // Let's draw a square centered at m.x, m.y
        const half = CONFIG.gridSize / 2;

        // Fill
        ctx.fillStyle = player.color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(m.x - half, m.y - half, CONFIG.gridSize, CONFIG.gridSize);

        // Outline
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(
            m.x - half,
            m.y - half,
            CONFIG.gridSize,
            CONFIG.gridSize
        );
    });
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    requestAnimationFrame(gameLoop);
}

window.onload = init;
