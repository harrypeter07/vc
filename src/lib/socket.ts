import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { NextApiResponse } from "next";

export type NextApiResponseServerIO = NextApiResponse & {
	socket: any & {
		server: NetServer & {
			io: SocketIOServer;
		};
	};
};

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
	});

	res.socket.server.io = io;

	io.on("connection", (socket) => {
		console.log(`Client connected: ${socket.id}`);

		socket.on("join-room", (roomId) => {
			socket.join(roomId);
			socket.to(roomId).emit("user-connected", socket.id);
			console.log(`User ${socket.id} joined room ${roomId}`);
		});

		socket.on("signal", ({ to, from, signal, type }) => {
			io.to(to).emit("signal", { from, signal, type });
		});

		socket.on("chat", ({ roomId, message, sender }) => {
			io.to(roomId).emit("chat", { message, sender });
		});

		socket.on("disconnect", () => {
			console.log(`Client disconnected: ${socket.id}`);
			socket.broadcast.emit("user-disconnected", socket.id);
		});
	});

	return io;
};
