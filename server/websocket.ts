import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { File } from "@shared/schema";

let wss: WebSocketServer;

export function setupWebSocket(server: Server) {
    wss = new WebSocketServer({ server, path: "/ws" });

    wss.on("connection", (ws) => {


        ws.on("close", () => {

        });

        ws.on("error", (error) => {
            console.error("WebSocket error:", error);
        });
    });


}

export function broadcastNewFile(file: File) {
    if (!wss) return;

    const { pin, key, ...sanitized } = file;
    const message = JSON.stringify({
        type: "NEW_FILE",
        payload: sanitized,
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

export function broadcastUpdateFile(file: File) {
    if (!wss) return;

    const { pin, key, ...sanitized } = file;
    const message = JSON.stringify({
        type: "UPDATE_FILE",
        payload: sanitized,
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

export function broadcastDeleteFile(fileId: string) {
    if (!wss) return;

    const message = JSON.stringify({
        type: "DELETE_FILE",
        payload: { id: fileId },
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
