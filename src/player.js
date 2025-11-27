export class Player {
    constructor(name, color, startGridPos) {
        this.name = name;
        this.color = color;
        this.gridPos = { ...startGridPos }; // Integer grid coordinates
        this.velocity = { x: 0, y: 0 }; // Grid units
        this.history = [{ ...startGridPos }];
        this.crashed = false;
    }

    move(targetGridPos) {
        const newVel = {
            x: targetGridPos.x - this.gridPos.x,
            y: targetGridPos.y - this.gridPos.y,
        };

        this.velocity = newVel;
        this.gridPos = { ...targetGridPos };
        this.history.push({ ...targetGridPos });
    }

    crash() {
        // Move back 2 turns
        if (this.history.length > 2) {
            this.history.pop(); // Remove current (invalid)
            this.history.pop(); // Remove previous
            const newPos = this.history[this.history.length - 1];
            this.gridPos = { ...newPos };

            // Recalculate velocity based on the move *before* the crash
            if (this.history.length > 1) {
                const prev = this.history[this.history.length - 2];
                this.velocity = {
                    x: this.gridPos.x - prev.x,
                    y: this.gridPos.y - prev.y,
                };
            } else {
                this.velocity = { x: 0, y: 0 };
            }
        } else {
            // Reset to start
            const start = this.history[0];
            this.history = [{ ...start }];
            this.gridPos = { ...start };
            this.velocity = { x: 0, y: 0 };
        }
    }

    getValidMoves() {
        const inertiaX = this.gridPos.x + this.velocity.x;
        const inertiaY = this.gridPos.y + this.velocity.y;
        const moves = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                moves.push({ x: inertiaX + dx, y: inertiaY + dy });
            }
        }
        return moves;
    }
}
