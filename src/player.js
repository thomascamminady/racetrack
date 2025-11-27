export class Player {
    constructor(name, color, startGridPos) {
        this.name = name;
        this.color = color;
        this.gridPos = { ...startGridPos }; // Integer grid coordinates
        this.velocity = { x: 0, y: 0 }; // Grid units
        this.history = [{ ...startGridPos }];
        this.crashed = false;
        this.crashCount = 0;
        this.moveCount = 0;
    }

    move(targetGridPos) {
        const newVel = {
            x: targetGridPos.x - this.gridPos.x,
            y: targetGridPos.y - this.gridPos.y,
        };

        this.velocity = newVel;
        this.gridPos = { ...targetGridPos };
        this.history.push({ ...targetGridPos });
        this.moveCount++;
    }

    crash() {
        this.crashCount++;
        this.moveCount++; // Crashing counts as a turn

        const penalty = this.crashCount;

        // Move back 'penalty' squares
        // We need to remove 'penalty' items from history
        // But ensure we don't go below 1 item (start pos)

        for (let i = 0; i < penalty; i++) {
            if (this.history.length > 1) {
                this.history.pop();
            }
        }

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

        return penalty;
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
