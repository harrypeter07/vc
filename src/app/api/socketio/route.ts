// src/app/api/socketio/route.ts
import { getIO } from "@/lib/socket";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		getIO(); // Initialize Socket.IO server
		return new Response(null, {
			status: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
		});
	} catch (error) {
		console.error("Socket.IO error:", error);
		return new Response("Internal Server Error", {
			status: 500,
		});
	}
}
