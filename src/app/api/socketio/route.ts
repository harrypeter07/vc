// src/app/api/socketio/route.ts
import { getSocketIO } from "@/lib/socket";

export const runtime = "nodejs";

export async function GET() {
	try {
		const io = getSocketIO();
		if (!io) {
			return new Response("Socket.io server not initialized", { status: 500 });
		}
		return new Response("Socket is alive");
	} catch (err) {
		console.error("Socket GET error:", err);
		return new Response("Internal Server Error", { status: 500 });
	}
}

export async function POST() {
	try {
		const io = getSocketIO();
		if (!io) {
			return new Response("Socket.io server not initialized", { status: 500 });
		}
		return new Response("Socket is alive");
	} catch (err) {
		console.error("Socket POST error:", err);
		return new Response("Internal Server Error", { status: 500 });
	}
}
