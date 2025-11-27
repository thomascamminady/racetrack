import { CONFIG } from "./constants.js";

export class Track {
    constructor() {
        this.path2D = null;
        this.points = []; // World coordinates of the drawn path
        this.width = CONFIG.trackWidth;
        this.startPoint = null; // Grid coordinates
        this.startDir = null;
        this.startLine = null;
    }

    generate(points, width) {
        this.points = points;
        this.width = width;

        if (points.length < 2) return;

        this.path2D = new Path2D();
        this.path2D.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.path2D.lineTo(points[i].x, points[i].y);
        }
        this.path2D.closePath();
    }

    setStartLine(grid, startRaw, dir) {
        this.startDir = dir;

        // Move start point behind the line by one grid cell size to ensure it's behind
        const offsetDist = grid.size;
        const behindX = startRaw.x - dir.x * offsetDist;
        const behindY = startRaw.y - dir.y * offsetDist;

        // Snap start point to grid
        const snapped = grid.toGrid(behindX, behindY);
        this.startPoint = snapped; // Store as grid coordinates

        // For the visual line, we want it to be "in front" of the car.
        // So we calculate the line position based on the original startRaw or slightly adjusted.
        // Let's place the line exactly between the start cell and the next cell.
        // Center of start cell:
        const startCellCenter = grid.toWorld(snapped.x, snapped.y);
        // Center of next cell (in direction of travel):
        // We approximate direction to nearest cardinal/diagonal for grid logic?
        // Or just use the vector.

        // Let's just place the line at startRaw snapped to grid, but keep car behind.
        // Actually, let's define the line based on the car position + half grid size in direction.

        const lineCenter = {
            x: startCellCenter.x + dir.x * grid.size,
            y: startCellCenter.y + dir.y * grid.size,
        };

        // Perpendicular vector
        const perp = { x: -dir.y, y: dir.x };
        const halfWidth = (this.width + CONFIG.borderWidth * 2) / 2;

        this.startLine = {
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

    isPointOnTrack(ctx, x, y) {
        if (!this.path2D) return false;
        ctx.save();
        ctx.lineWidth = this.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const isInside = ctx.isPointInStroke(this.path2D, x, y);
        ctx.restore();
        return isInside;
    }

    // Check if a segment intersects the start line in the correct direction
    checkLap(p1World, p2World) {
        if (!this.startLine) return false;

        if (
            segmentsIntersect(
                p1World,
                p2World,
                this.startLine.p1,
                this.startLine.p2
            )
        ) {
            const moveDir = {
                x: p2World.x - p1World.x,
                y: p2World.y - p1World.y,
            };
            const dot =
                moveDir.x * this.startDir.x + moveDir.y * this.startDir.y;
            return dot > 0;
        }
        return false;
    }
}

function segmentsIntersect(a, b, c, d) {
    const det = (b.x - a.x) * (d.y - c.y) - (d.x - c.x) * (b.y - a.y);
    if (det === 0) return false;
    const lambda =
        ((d.y - c.y) * (d.x - a.x) + (c.x - d.x) * (d.y - a.y)) / det;
    const gamma = ((a.y - b.y) * (d.x - a.x) + (b.x - a.x) * (d.y - a.y)) / det;
    return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
}
