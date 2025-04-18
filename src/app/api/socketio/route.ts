import { NextResponse } from "next/server";
import { getIO } from "@/lib/socket";

export const dynamic = "force-dynamic";

export async function GET() {
	const io = getIO();
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
