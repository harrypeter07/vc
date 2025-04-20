import { getIO } from "@/lib/socket";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const io = getIO();

		if (!io) {
			return new Response("Socket.IO server not initialized", {
				status: 500,
			});
		}

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
