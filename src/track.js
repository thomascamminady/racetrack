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
        // Snap direction to nearest cardinal
        let snapDir = { x: 0, y: 0 };
        if (Math.abs(dir.x) > Math.abs(dir.y)) {
            snapDir.x = Math.sign(dir.x);
        } else {
            snapDir.y = Math.sign(dir.y);
        }
        this.startDir = snapDir;

        // 1. Determine Start Line Center
        // We want the start line to be centered on the track path (startRaw)
        // but snapped to be perpendicular to travel.
        // If travel is X, line is vertical. X is fixed, Y is centered on track.
        // Actually, if we want it to be a "finish line", it should be at a specific point along the track.
        // Let's use startRaw as the center of the line.

        const lineCenter = { ...startRaw };

        // 2. Determine Car Position
        // The car must be on a grid center.
        // It should be "behind" the line.
        // We search for the nearest grid center that is behind the line.

        // Candidate grid point near startRaw
        const rawGrid = grid.toGrid(startRaw.x, startRaw.y);

        // We check the cell at rawGrid, and maybe one step back?
        // If startRaw is exactly at a grid center, and line is there, car should be one step back.
        // If startRaw is between cells, maybe the car can be at the cell behind?

        // Let's try: Car is at grid cell -1 step in direction from the line center?
        // Or just find the nearest grid cell to (lineCenter - step).

        const targetCarPosWorld = {
            x: lineCenter.x - snapDir.x * grid.size,
            y: lineCenter.y - snapDir.y * grid.size,
        };

        const carGridPos = grid.toGrid(
            targetCarPosWorld.x,
            targetCarPosWorld.y
        );
        this.startPoint = carGridPos;

        // 3. Define Start Line Geometry
        // Make it wide enough to cover the track even if diagonal
        // Width * 2 should be safe.
        const lineWidth = (this.width + CONFIG.borderWidth * 2) * 2;
        const perp = { x: -snapDir.y, y: snapDir.x };

        this.startLine = {
            p1: {
                x: lineCenter.x + (perp.x * lineWidth) / 2,
                y: lineCenter.y + (perp.y * lineWidth) / 2,
            },
            p2: {
                x: lineCenter.x - (perp.x * lineWidth) / 2,
                y: lineCenter.y - (perp.y * lineWidth) / 2,
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
