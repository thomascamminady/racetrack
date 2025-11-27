import { CONFIG } from "./constants.js";

export class Renderer {
    constructor(canvas, grid) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.grid = grid;
        this.camera = { x: 0, y: 0, zoom: 1 };
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    setCamera(x, y, zoom) {
        this.camera = { x, y, zoom };
    }

    clear() {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }

    beginFrame() {
        this.clear();
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
    }

    endFrame() {
        this.ctx.restore();
    }

    drawTrack(track) {
        if (!track.path2D) return;

        const ctx = this.ctx;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Border
        ctx.lineWidth = track.width + CONFIG.borderWidth * 2;
        ctx.strokeStyle = "#94a3b8";
        ctx.stroke(track.path2D);

        // Surface
        ctx.lineWidth = track.width;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke(track.path2D);

        // Start Line
        if (track.startLine) {
            ctx.beginPath();
            ctx.moveTo(track.startLine.p1.x, track.startLine.p1.y);
            ctx.lineTo(track.startLine.p2.x, track.startLine.p2.y);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 4;
            ctx.stroke();

            // Arrow
            if (track.startDir) {
                this.drawArrow(track.startLine, track.startDir);
            }
        }
    }

    drawArrow(startLine, dir) {
        const ctx = this.ctx;
        const center = {
            x: (startLine.p1.x + startLine.p2.x) / 2,
            y: (startLine.p1.y + startLine.p2.y) / 2,
        };
        const arrowLen = 40;
        const arrowEnd = {
            x: center.x + dir.x * arrowLen,
            y: center.y + dir.y * arrowLen,
        };

        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(arrowEnd.x, arrowEnd.y);

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

    drawGridLines(visibleRect) {
        const ctx = this.ctx;
        const size = this.grid.size;

        // Calculate visible grid range
        // We want to draw a huge grid, but efficiently.
        // For now, let's stick to a large fixed area or dynamic based on view.
        // Let's use a large fixed area for simplicity as per previous implementation,
        // but aligned to the grid class.

        const startX = Math.floor(-5000 / size) * size;
        const endX = Math.ceil(5000 / size) * size;
        const startY = Math.floor(-5000 / size) * size;
        const endY = Math.ceil(5000 / size) * size;

        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();

        // Vertical lines
        // We want lines to be between cells.
        // If a cell is at (0,0), its center is (0,0) in world space (if we define it that way).
        // Grid.toWorld(0,0) -> 0,0.
        // Cell rect is -size/2 to size/2.
        // So lines should be at x = n * size + size/2.

        const offset = size / 2;

        for (let x = startX; x <= endX; x += size) {
            ctx.moveTo(x + offset, startY);
            ctx.lineTo(x + offset, endY);
        }
        for (let y = startY; y <= endY; y += size) {
            ctx.moveTo(startX, y + offset);
            ctx.lineTo(endX, y + offset);
        }
        ctx.stroke();
    }

    drawPreviewPath(path) {
        if (path.length < 2) return;
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2563eb";
        ctx.stroke();
    }

    drawPlayer(player, isActive) {
        const ctx = this.ctx;
        const worldPos = this.grid.toWorld(player.gridPos.x, player.gridPos.y);

        // History
        if (player.history.length > 1) {
            ctx.beginPath();
            const start = this.grid.toWorld(
                player.history[0].x,
                player.history[0].y
            );
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i < player.history.length; i++) {
                const pt = this.grid.toWorld(
                    player.history[i].x,
                    player.history[i].y
                );
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = player.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Active Highlight
        if (isActive) {
            ctx.beginPath();
            ctx.arc(worldPos.x, worldPos.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = player.color;
            ctx.globalAlpha = 0.3;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            ctx.beginPath();
            ctx.arc(worldPos.x, worldPos.y, 12, 0, Math.PI * 2);
            ctx.strokeStyle = player.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Player Dot
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(worldPos.x, worldPos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawValidMoves(player, moves) {
        const ctx = this.ctx;
        const worldPos = this.grid.toWorld(player.gridPos.x, player.gridPos.y);

        // Inertia Line
        const inertiaGridX = player.gridPos.x + player.velocity.x;
        const inertiaGridY = player.gridPos.y + player.velocity.y;
        const inertiaWorld = this.grid.toWorld(inertiaGridX, inertiaGridY);

        ctx.beginPath();
        ctx.moveTo(worldPos.x, worldPos.y);
        ctx.lineTo(inertiaWorld.x, inertiaWorld.y);
        ctx.strokeStyle = player.color;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Move Cells
        moves.forEach((move) => {
            const rect = this.grid.getCellRect(move.x, move.y);

            ctx.fillStyle = player.color;
            ctx.globalAlpha = 0.2;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = player.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        });
        ctx.globalAlpha = 1.0;
    }
}
