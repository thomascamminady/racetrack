export const STATE = {
    DRAWING: "DRAWING",
    SETUP: "SETUP",
    RACING: "RACING",
    FINISHED: "FINISHED",
};

export const CONFIG = {
    gridSize: 30, // Default, mutable
    trackWidth: 80,
    borderWidth: 4,
    colors: ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
    minZoom: 0.1,
    maxZoom: 5.0,
};
