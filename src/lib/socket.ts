import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { NextApiResponse } from "next";

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

export const getIO = (res?: NextApiResponseServerIO) => {
	if (io) {
		return io;
	}

	if (!res) {
		throw new Error("Server IO not initialized");
	}

	const httpServer: NetServer = res.socket.server;
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

	res.socket.server.io = io;

	io.on("connection", (socket) => {
		console.log(`Client connected: ${socket.id}`);

		socket.on("join-room", (roomId) => {
			socket.join(roomId);
			const roomClients = io.sockets.adapter.rooms.get(roomId)?.size || 0;
			socket.to(roomId).emit("user-connected", {
				userId: socket.id,
				clientCount: roomClients,
			});
			console.log(
				`User ${socket.id} joined room ${roomId}. Total clients: ${roomClients}`
			);
		});

		socket.on("signal", ({ to, from, signal, type }: SignalData) => {
			if (to && !io.sockets.adapter.rooms.get(to)) {
				socket.emit("peer-disconnected", to);
				return;
			}
			if (to) {
				io.to(to).emit("signal", { from, signal, type });
			}
		});

		socket.on("chat", ({ roomId, message, sender }: ChatData) => {
			if (!message.trim()) return;
			io.to(roomId).emit("chat", { message: message.trim(), sender });
		});

		socket.on("disconnect", () => {
			console.log(`Client disconnected: ${socket.id}`);
			const rooms = Array.from(socket.rooms);
			rooms.forEach((roomId) => {
				const roomClients = io.sockets.adapter.rooms.get(roomId)?.size || 0;
				socket.to(roomId).emit("user-disconnected", {
					userId: socket.id,
					clientCount: Math.max(0, roomClients - 1),
				});
			});
		});
	});

	return io;
};
