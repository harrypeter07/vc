import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { NextApiResponse } from "next";
import { createServer } from "http";

interface SocketServer extends NetServer {
	io: SocketIOServer;
}

interface SocketWithServer {
	server: SocketServer;
}

export type NextApiResponseServerIO = NextApiResponse & {
	socket: SocketWithServer;
};

export interface SignalData {
	to?: string;
	from: string;
	signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
	type: "offer" | "answer";
}

export interface ChatData {
	roomId: string;
	message: string;
	sender: string;
}

export const config = {
	api: {
		bodyParser: false,
	},
};

let io: SocketIOServer;
let httpServer: NetServer;

export const getIO = () => {
	if (io) {
		return io;
	}

	if (!httpServer) {
		httpServer = createServer();
	}

	io = new SocketIOServer(httpServer, {
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

		socket.on("join-room", (roomId) => {
			console.log(`User ${socket.id} attempting to join room ${roomId}`);

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
			const roomClients = io.sockets.adapter.rooms.get(roomId)?.size || 0;
			console.log(`Room ${roomId} now has ${roomClients} clients`);

			// Notify everyone in the room (including the new user) about the updated count
			io.in(roomId).emit("user-connected", {
				userId: socket.id,
				clientCount: roomClients,
			});
			console.log(
				`Notified all users in room ${roomId} about new user ${socket.id} and updated count ${roomClients}`
			);

			// Send current peers list to the new user
			const roomSockets = Array.from(
				io.sockets.adapter.rooms.get(roomId) || []
			);
			const peers = roomSockets.filter((id) => id !== socket.id);
			if (peers.length > 0) {
				console.log(`Sending existing peers to new user ${socket.id}:`, peers);
				socket.emit("existing-peers", {
					peers,
					clientCount: roomClients,
				});
			}
		});

		socket.on("signal", ({ to, from, signal, type }: SignalData) => {
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

		socket.on("chat", ({ roomId, message, sender }: ChatData) => {
			console.log(
				`Chat message received - Room: ${roomId}, Sender: ${sender}, Message: ${message}`
			);
			if (!message.trim()) {
				console.log("Empty message, ignoring");
				return;
			}

			// Only broadcast to others in the room (including sender)
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
				const roomClients = io.sockets.adapter.rooms.get(roomId)?.size || 0;
				console.log(
					`Notifying room ${roomId} about disconnection of ${socket.id}`
				);
				socket.to(roomId).emit("user-disconnected", {
					userId: socket.id,
					clientCount: Math.max(0, roomClients - 1),
				});
			});
		});
	});

	// Start the server on a different port
	const PORT = process.env.SOCKET_PORT || 3001;
	httpServer.listen(PORT, () => {
		console.log(`Socket.IO server running on port ${PORT}`);
	});

	return io;
};
