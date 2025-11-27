import { CONFIG } from "./constants.js";

export class Grid {
    constructor(size = CONFIG.gridSize) {
        this.size = size;
    }

    setSize(size) {
        this.size = size;
    }

    // Convert world coordinate to integer grid coordinate
    toGrid(worldX, worldY) {
        return {
            x: Math.round(worldX / this.size),
            y: Math.round(worldY / this.size),
        };
    }

    // Convert integer grid coordinate to world coordinate (center of cell)
    toWorld(gridX, gridY) {
        return {
            x: gridX * this.size,
            y: gridY * this.size,
        };
    }

    // Snap a world point to the nearest grid center
    snap(worldX, worldY) {
        const gridPos = this.toGrid(worldX, worldY);
        return this.toWorld(gridPos.x, gridPos.y);
    }

    getCellRect(gridX, gridY) {
        const center = this.toWorld(gridX, gridY);
        return {
            x: center.x - this.size / 2,
            y: center.y - this.size / 2,
            width: this.size,
            height: this.size,
        };
    }
}
