import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";

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

// Store for email and password per room (in-memory for simplicity)
const roomCredentials: { [roomId: string]: { [email: string]: string } } = {};
const roomUsers: { [roomId: string]: { [socketId: string]: string } } = {};

let io: SocketIOServer | null = null;
let httpServer: ReturnType<typeof createServer> | null = null;

export const getIO = () => {
	if (io) {
		return io;
	}

	if (!httpServer) {
		httpServer = createServer();
	}

	io = new SocketIOServer(httpServer, {
		path: "/socketio",
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
		const email = socket.handshake.query.email as string;
		const roomId = socket.handshake.query.roomId as string;

		// If email and roomId are provided in the connection, check for existing socket
		if (email && roomId) {
			const room = io!.sockets.adapter.rooms.get(roomId);
			if (room) {
				// Check if this email already has a socket in the room
				const existingSocket = Array.from(room).find(
					(socketId) => roomUsers[roomId]?.[socketId] === email
				);

				if (existingSocket) {
					console.log(
						`Duplicate connection attempt from ${email} in room ${roomId}. Disconnecting new socket.`
					);
					socket.disconnect();
					return;
				}
			}
		}

		socket.on(
			"join-room",
			({
				roomId,
				email,
				password,
			}: {
				roomId: string;
				email: string;
				password: string;
			}) => {
				console.log(
					`User ${socket.id} attempting to join room ${roomId} with email ${email}`
				);

				// Initialize room credentials if not exists
				if (!roomCredentials[roomId]) {
					roomCredentials[roomId] = {};
					roomUsers[roomId] = {};
				}

				// Check for duplicate email in the room
				if (Object.values(roomUsers[roomId]).includes(email)) {
					console.log(
						`Duplicate email ${email} in room ${roomId}. Rejecting user ${socket.id}`
					);
					socket.emit("join-error", {
						message: "This email is already in use in the room.",
					});
					return;
				}

				// Validate credentials
				if (
					roomCredentials[roomId][email] &&
					roomCredentials[roomId][email] !== password
				) {
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
				const room = io!.sockets.adapter.rooms.get(roomId);
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
				const roomClients = io!.sockets.adapter.rooms.get(roomId)?.size || 0;
				console.log(`Room ${roomId} now has ${roomClients} clients`);

				io!.in(roomId).emit("user-connected", {
					userId: socket.id,
					clientCount: roomClients,
				});

				const roomSockets = Array.from(
					io!.sockets.adapter.rooms.get(roomId) || []
				);
				const peers = roomSockets.filter((id) => id !== socket.id);
				if (peers.length > 0) {
					console.log(
						`Sending existing peers to new user ${socket.id}:`,
						peers
					);
					socket.emit("existing-peers", {
						peers,
						clientCount: roomClients,
					});
				}
			}
		);

		socket.on("leave-room", ({ roomId }: { roomId: string }) => {
			console.log(`User ${socket.id} leaving room ${roomId}`);
			if (roomUsers[roomId] && roomUsers[roomId][socket.id]) {
				delete roomUsers[roomId][socket.id];
				console.log(
					`Removed user ${socket.id} from roomUsers for room ${roomId}`
				);
			}
			socket.leave(roomId);
			const roomClients = io!.sockets.adapter.rooms.get(roomId)?.size || 0;
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

		socket.on("signal", ({ to, from, signal, type }: SignalData) => {
			console.log(`Received ${type} signal from ${from} to ${to}`);
			if (to && !io!.sockets.adapter.rooms.get(to)) {
				console.log(`Target peer ${to} not found in any room`);
				socket.emit("peer-disconnected", to);
				return;
			}
			if (to) {
				console.log(`Forwarding ${type} signal from ${from} to ${to}`);
				io!.to(to).emit("signal", { from, signal, type });
			}
		});

		// Add support for screen sharing signaling
		socket.on("screen-signal", ({ to, from, signal, type }: SignalData) => {
			console.log(`Received ${type} (screen) signal from ${from} to ${to}`);
			if (to && !io!.sockets.adapter.rooms.get(to)) {
				console.log(`Target peer ${to} not found in any room (screen)`);
				socket.emit("peer-disconnected", to);
				return;
			}
			if (to) {
				console.log(`Forwarding ${type} (screen) signal from ${from} to ${to}`);
				io!.to(to).emit("screen-signal", { from, signal, type });
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

			io!.in(roomId).emit("chat", {
				message: message.trim(),
				sender,
			});
			console.log(`Chat message broadcast to room ${roomId}`);
		});

		// Call signaling: call-initiate and call-accept
		socket.on(
			"call-initiate",
			({ roomId, from }: { roomId: string; from: string }) => {
				// Find the other user in the room
				const room = io!.sockets.adapter.rooms.get(roomId);
				if (room) {
					for (const socketId of room) {
						if (socketId !== from) {
							io!.to(socketId).emit("call-incoming", { from });
						}
					}
				}
			}
		);

		socket.on(
			"call-accept",
			({ roomId, from }: { roomId: string; from: string }) => {
				// Find the other user in the room
				const room = io!.sockets.adapter.rooms.get(roomId);
				if (room) {
					for (const socketId of room) {
						if (socketId !== from) {
							io!.to(socketId).emit("call-accepted", { from });
						}
					}
				}
			}
		);

		socket.on("disconnect", () => {
			console.log(`Client disconnecting: ${socket.id}`);
			const rooms = Array.from(socket.rooms);
			rooms.forEach((roomId) => {
				// Skip the socket's own room (its ID)
				if (roomId === socket.id) return;
				if (roomUsers[roomId] && roomUsers[roomId][socket.id]) {
					delete roomUsers[roomId][socket.id];
					console.log(
						`Removed user ${socket.id} from roomUsers for room ${roomId}`
					);
				}
				const roomClients = io!.sockets.adapter.rooms.get(roomId)?.size || 0;
				console.log(
					`Notifying room ${roomId} about disconnection of ${socket.id}`
				);
				// Notify other users in the room
				io!.to(roomId).emit("user-disconnected", {
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
