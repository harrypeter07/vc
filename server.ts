import { getIO } from "./src/lib/socket";

// Initialize the Socket.IO server
const io = getIO();

// Ensure the HTTP server listens on a port
const httpServer = (io as any).httpServer || (global as any).httpServer;
const PORT = process.env.PORT || 3001;
if (httpServer && typeof httpServer.listen === "function") {
	httpServer.listen(PORT, () => {
		console.log(`Socket.IO server listening on port ${PORT}`);
	});
}
