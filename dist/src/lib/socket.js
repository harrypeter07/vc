"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = void 0;
const socket_io_1 = require("socket.io");
const http_1 = require("http");
// Store for email and password per room (in-memory for simplicity)
const roomCredentials = {};
const roomUsers = {};
let io = null;
let httpServer = null;
const getIO = () => {
    if (io) {
        return io;
    }
    if (!httpServer) {
        httpServer = (0, http_1.createServer)();
    }
    io = new socket_io_1.Server(httpServer, {
        path: "/api/socketio",
        addTrailingSlash: false,
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
        transports: ["websocket"],
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: true,
        },
    });
    io.on("connection", (socket) => {
        console.log(`Client connected: ${socket.id}`);
        // Get email and roomId from query params
        const email = socket.handshake.query.email;
        const roomId = socket.handshake.query.roomId;
        // If email and roomId are provided in the connection, check for existing socket
        if (email && roomId) {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (room) {
                // Check if this email already has a socket in the room
                const existingSocket = Array.from(room).find((socketId) => { var _a; return ((_a = roomUsers[roomId]) === null || _a === void 0 ? void 0 : _a[socketId]) === email; });
                if (existingSocket) {
                    console.log(`Duplicate connection attempt from ${email} in room ${roomId}. Disconnecting new socket.`);
                    socket.disconnect();
                    return;
                }
            }
        }
        socket.on("join-room", ({ roomId, email, password, }) => {
            var _a;
            console.log(`User ${socket.id} attempting to join room ${roomId} with email ${email}`);
            // Initialize room credentials if not exists
            if (!roomCredentials[roomId]) {
                roomCredentials[roomId] = {};
                roomUsers[roomId] = {};
            }
            // Check for duplicate email in the room
            if (Object.values(roomUsers[roomId]).includes(email)) {
                console.log(`Duplicate email ${email} in room ${roomId}. Rejecting user ${socket.id}`);
                socket.emit("join-error", {
                    message: "This email is already in use in the room.",
                });
                return;
            }
            // Validate credentials
            if (roomCredentials[roomId][email] &&
                roomCredentials[roomId][email] !== password) {
                console.log(`Invalid password for email ${email} in room ${roomId}`);
                socket.emit("join-error", {
                    message: "Invalid email or password.",
                });
                return;
            }
            // Store credentials if new user
            if (!roomCredentials[roomId][email]) {
                roomCredentials[roomId][email] = password;
            }
            // Check if room is full (2 clients max)
            const room = io.sockets.adapter.rooms.get(roomId);
            const roomSize = room ? room.size : 0;
            if (roomSize >= 2) {
                console.log(`Room ${roomId} is full. Rejecting user ${socket.id}`);
                socket.emit("room-full", {
                    message: "This room is full. Maximum 2 participants allowed.",
                });
                return;
            }
            socket.join(roomId);
            roomUsers[roomId][socket.id] = email;
            const roomClients = ((_a = io.sockets.adapter.rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.size) || 0;
            console.log(`Room ${roomId} now has ${roomClients} clients`);
            io.in(roomId).emit("user-connected", {
                userId: socket.id,
                clientCount: roomClients,
            });
            const roomSockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
            const peers = roomSockets.filter((id) => id !== socket.id);
            if (peers.length > 0) {
                console.log(`Sending existing peers to new user ${socket.id}:`, peers);
                socket.emit("existing-peers", {
                    peers,
                    clientCount: roomClients,
                });
            }
        });
        socket.on("leave-room", ({ roomId }) => {
            var _a;
            console.log(`User ${socket.id} leaving room ${roomId}`);
            if (roomUsers[roomId] && roomUsers[roomId][socket.id]) {
                delete roomUsers[roomId][socket.id];
                console.log(`Removed user ${socket.id} from roomUsers for room ${roomId}`);
            }
            socket.leave(roomId);
            const roomClients = ((_a = io.sockets.adapter.rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.size) || 0;
            socket.to(roomId).emit("user-disconnected", {
                userId: socket.id,
                clientCount: roomClients,
            });
            // Clean up empty room
            if (roomClients === 0) {
                delete roomUsers[roomId];
                delete roomCredentials[roomId];
                console.log(`Cleaned up empty room ${roomId}`);
            }
        });
        socket.on("signal", ({ to, from, signal, type }) => {
            console.log(`Received ${type} signal from ${from} to ${to}`);
            if (to && !io.sockets.adapter.rooms.get(to)) {
                console.log(`Target peer ${to} not found in any room`);
                socket.emit("peer-disconnected", to);
                return;
            }
            if (to) {
                console.log(`Forwarding ${type} signal from ${from} to ${to}`);
                io.to(to).emit("signal", { from, signal, type });
            }
        });
        socket.on("chat", ({ roomId, message, sender }) => {
            console.log(`Chat message received - Room: ${roomId}, Sender: ${sender}, Message: ${message}`);
            if (!message.trim()) {
                console.log("Empty message, ignoring");
                return;
            }
            io.in(roomId).emit("chat", {
                message: message.trim(),
                sender,
            });
            console.log(`Chat message broadcast to room ${roomId}`);
        });
        socket.on("disconnect", () => {
            console.log(`Client disconnecting: ${socket.id}`);
            const rooms = Array.from(socket.rooms);
            rooms.forEach((roomId) => {
                var _a;
                // Skip the socket's own room (its ID)
                if (roomId === socket.id)
                    return;
                if (roomUsers[roomId] && roomUsers[roomId][socket.id]) {
                    delete roomUsers[roomId][socket.id];
                    console.log(`Removed user ${socket.id} from roomUsers for room ${roomId}`);
                }
                const roomClients = ((_a = io.sockets.adapter.rooms.get(roomId)) === null || _a === void 0 ? void 0 : _a.size) || 0;
                console.log(`Notifying room ${roomId} about disconnection of ${socket.id}`);
                // Notify other users in the room
                io.to(roomId).emit("user-disconnected", {
                    userId: socket.id,
                    clientCount: Math.max(0, roomClients),
                });
                // Clean up empty room
                if (roomClients === 0) {
                    delete roomUsers[roomId];
                    delete roomCredentials[roomId];
                    console.log(`Cleaned up empty room ${roomId}`);
                }
            });
        });
    });
    return io;
};
exports.getIO = getIO;
