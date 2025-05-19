"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_1 = require("./src/lib/socket");
// Initialize the Socket.IO server
const io = (0, socket_1.getIO)();
// Ensure the HTTP server listens on a port
const httpServer = io.httpServer || global.httpServer;
const PORT = process.env.PORT || 3001;
if (httpServer && typeof httpServer.listen === "function") {
    httpServer.listen(PORT, () => {
        console.log(`Socket.IO server listening on port ${PORT}`);
    });
}
