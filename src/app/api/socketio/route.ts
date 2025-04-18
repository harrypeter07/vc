import { Server } from "socket.io";
import { NextResponse } from "next/server";
import { createServer } from "http";

let io: Server | null = null;

if (!io) {
	const httpServer = createServer();
	io = new Server(httpServer, {
		path: "/api/socketio",
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
		},
	});

	io.on("connection", (socket) => {
		console.log(`Client connected: ${socket.id}`);

		socket.on("join-room", (roomId) => {
			socket.join(roomId);
			const roomClients = io?.sockets.adapter.rooms.get(roomId)?.size || 0;
			socket.to(roomId).emit("user-connected", {
				userId: socket.id,
				clientCount: roomClients,
			});
			console.log(
				`User ${socket.id} joined room ${roomId}. Total clients: ${roomClients}`
			);
		});

		socket.on("signal", ({ to, from, signal, type }) => {
			io?.to(to).emit("signal", { from, signal, type });
		});

		socket.on("chat", ({ roomId, message, sender }) => {
			io?.to(roomId).emit("chat", { message, sender });
		});

		socket.on("disconnect", () => {
			console.log(`Client disconnected: ${socket.id}`);
			socket.broadcast.emit("user-disconnected", socket.id);
		});
	});

	httpServer.listen(3001);
	console.log("Socket.IO server is running on port 3001");
}

export async function GET() {
	if (!io) {
		return new NextResponse("Socket.IO server not initialized", {
			status: 500,
		});
	}

	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
}

export const dynamic = "force-dynamic";
