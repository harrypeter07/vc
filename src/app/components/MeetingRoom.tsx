"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
import { SignalData, ChatData } from "@/lib/socket";
import { useRouter } from "next/navigation";
import VideoPlayer from "./VideoPlayer";
import ChatPanel from "./ChatPanel";
import Controls from "./Controls";

interface ChatMessage {
	message: string;
	sender: string;
}

interface MeetingRoomProps {
	roomId: string;
}

export default function MeetingRoom({ roomId }: MeetingRoomProps) {
	const [socket, setSocket] = useState<Socket | null>(null);
	const socketRef = useRef<Socket | null>(null);
	const [peers, setPeers] = useState<{ [key: string]: SimplePeer.Instance }>(
		{}
	);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [messageInput, setMessageInput] = useState("");
	const [participantCount, setParticipantCount] = useState(1);
	const [error, setError] = useState<string | null>(null);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const router = useRouter();

	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		// Initialize socket connection
		const socketInit = async () => {
			try {
				// If socket already exists, don't create a new one
				if (socketRef.current) {
					console.log("Socket already exists, reusing connection");
					return;
				}

				console.log("Initializing new socket connection...");
				await fetch("/api/socketio");
				const newSocket = io(
					`http://localhost:${process.env.NEXT_PUBLIC_SOCKET_PORT || 3001}`,
					{
						path: "/api/socketio",
						transports: ["websocket"],
						reconnection: true,
						reconnectionAttempts: 3,
						reconnectionDelay: 1000,
						query: {
							userId: localStorage.getItem("userId") || Date.now().toString(),
						},
					}
				);

				newSocket.on("connect", () => {
					console.log("Connected to Socket.IO server with ID:", newSocket.id);
					localStorage.setItem("userId", newSocket.id || "");
					newSocket.emit("join-room", roomId);
				});

				newSocket.on("room-full", ({ message }) => {
					console.log("Room is full:", message);
					setError(message);
					// Redirect to home page after 3 seconds
					setTimeout(() => {
						router.push("/");
					}, 3000);
				});

				newSocket.on("connect_error", (error) => {
					console.error("Socket connection error:", error);
				});

				socketRef.current = newSocket;
				setSocket(newSocket);
			} catch (error) {
				console.error("Failed to initialize socket:", error);
			}
		};
		socketInit();

		// Get user media
		navigator.mediaDevices
			.getUserMedia({ video: true, audio: true })
			.then((mediaStream) => {
				setStream(mediaStream);
				if (localVideoRef.current) {
					localVideoRef.current.srcObject = mediaStream;
				}
			})
			.catch((err) => {
				console.error("Error accessing media devices:", err);
			});

		return () => {
			if (socketRef.current) {
				socketRef.current.disconnect();
				socketRef.current = null;
			}
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}
			Object.values(peers).forEach((peer) => peer.destroy());
		};
	}, [roomId]); // Only re-run if roomId changes

	useEffect(() => {
		if (!socket || !stream) return;

		console.log("Setting up socket event listeners...");

		const handleUserConnected = ({
			userId,
			clientCount,
		}: {
			userId: string;
			clientCount: number;
		}) => {
			console.log("New user connected:", userId, "Total clients:", clientCount);
			setParticipantCount(clientCount);

			// Only create a new peer connection if this is a new user
			if (userId !== socket.id && !peers[userId]) {
				const peer = new SimplePeer({
					initiator: true,
					stream,
					trickle: false,
				});

				peer.on("signal", (data) => {
					console.log("Sending offer to:", userId);
					socket.emit("signal", {
						to: userId,
						from: socket.id,
						signal: data,
						type: "offer",
					});
				});

				peer.on("stream", (remoteStream) => {
					console.log("Received stream from:", userId);
					if (remoteVideoRef.current) {
						remoteVideoRef.current.srcObject = remoteStream;
					}
				});

				peer.on("error", (err) => console.error("Peer error:", err));

				setPeers((prev) => ({ ...prev, [userId]: peer }));
			}
		};

		const handleExistingPeers = ({
			peers: existingPeers,
			clientCount,
		}: {
			peers: string[];
			clientCount: number;
		}) => {
			console.log(
				"Received existing peers:",
				existingPeers,
				"Total clients:",
				clientCount
			);
			setParticipantCount(clientCount);

			// Create peer connections for each existing peer
			existingPeers.forEach((peerId) => {
				if (!peers[peerId]) {
					const peer = new SimplePeer({
						initiator: false,
						stream,
						trickle: false,
					});

					peer.on("signal", (data) => {
						console.log("Sending answer to:", peerId);
						socket.emit("signal", {
							to: peerId,
							from: socket.id,
							signal: data,
							type: "answer",
						});
					});

					peer.on("stream", (remoteStream) => {
						console.log("Received stream from existing peer:", peerId);
						if (remoteVideoRef.current) {
							remoteVideoRef.current.srcObject = remoteStream;
						}
					});

					peer.on("error", (err) => console.error("Peer error:", err));

					setPeers((prev) => ({ ...prev, [peerId]: peer }));
				}
			});
		};

		const handleSignal = ({ from, signal, type }: SignalData) => {
			console.log("Received signal:", type, "from:", from);

			if (type === "offer") {
				const peer = new SimplePeer({
					initiator: false,
					stream,
					trickle: false,
				});

				peer.on("signal", (data) => {
					console.log("Sending answer to:", from);
					socket.emit("signal", {
						to: from,
						from: socket.id,
						signal: data,
						type: "answer",
					});
				});

				peer.on("stream", (remoteStream) => {
					console.log("Received stream from:", from);
					if (remoteVideoRef.current) {
						remoteVideoRef.current.srcObject = remoteStream;
					}
				});

				peer.on("error", (err) => console.error("Peer error:", err));

				peer.signal(signal as string);
				setPeers((prev) => ({ ...prev, [from]: peer }));
			} else if (type === "answer") {
				console.log("Processing answer from:", from);
				const peer = peers[from];
				if (peer) {
					peer.signal(signal as string);
				}
			}
		};

		const handleUserDisconnected = ({
			userId,
			clientCount,
		}: {
			userId: string;
			clientCount: number;
		}) => {
			console.log("User disconnected:", userId, "Total clients:", clientCount);
			if (peers[userId]) {
				peers[userId].destroy();
				setPeers((prev) => {
					const newPeers = { ...prev };
					delete newPeers[userId];
					return newPeers;
				});
			}
			setParticipantCount(clientCount);
			if (remoteVideoRef.current && Object.keys(peers).length === 0) {
				remoteVideoRef.current.srcObject = null;
			}
		};

		const handleChat = ({
			message,
			sender,
		}: {
			message: string;
			sender: string;
		}) => {
			console.log("Received chat message:", message, "from:", sender);
			// Only add message if it's from someone else or it's our first time seeing our own message
			if (
				sender !== socket.id ||
				!chatMessages.some(
					(msg) => msg.message === message && msg.sender === sender
				)
			) {
				setChatMessages((prev) => [...prev, { message, sender }]);
			}
		};

		socket.on("user-connected", handleUserConnected);
		socket.on("existing-peers", handleExistingPeers);
		socket.on("signal", handleSignal);
		socket.on("user-disconnected", handleUserDisconnected);
		socket.on("chat", handleChat);

		return () => {
			console.log("Cleaning up socket event listeners...");
			socket.off("user-connected", handleUserConnected);
			socket.off("existing-peers", handleExistingPeers);
			socket.off("signal", handleSignal);
			socket.off("user-disconnected", handleUserDisconnected);
			socket.off("chat", handleChat);
		};
	}, [socket, stream, roomId, peers, chatMessages]);

	const sendMessage = () => {
		if (!socket || !messageInput.trim()) return;

		console.log("Sending chat message:", messageInput.trim());
		const chatData: ChatData = {
			roomId,
			message: messageInput.trim(),
			sender: socket.id || "", // Add fallback for undefined
		};
		socket.emit("chat", chatData);
		setMessageInput("");
	};

	const toggleChat = () => {
		setIsChatOpen(!isChatOpen);
	};

	if (error) {
		return (
			<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
				<div className="bg-white p-6 rounded-lg shadow-xl">
					<h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
					<p className="text-gray-700 mb-4">{error}</p>
					<p className="text-gray-500">Redirecting to home page...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="relative h-screen bg-gray-900">
			{/* Meeting Info Bar */}
			<div className="absolute top-0 left-0 right-0 h-16 bg-gray-800 flex items-center px-6 z-10">
				<div className="flex items-center space-x-4">
					<h1 className="text-white font-medium">Room: {roomId}</h1>
					<span className="text-gray-400">|</span>
					<p className="text-gray-300">Participants: {participantCount}/2</p>
				</div>
			</div>

			{/* Main Content */}
			<div className="h-full pt-16 pb-16 flex">
				{/* Video Grid */}
				<div
					className={`flex-1 p-4 ${
						isChatOpen ? "pr-[400px]" : ""
					} transition-all duration-300`}
				>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
						<div className="relative">
							<VideoPlayer
								videoRef={localVideoRef}
								isMuted={true}
								isLocal={true}
								label="You"
							/>
						</div>
						{Object.keys(peers).length > 0 && (
							<div className="relative">
								<VideoPlayer videoRef={remoteVideoRef} label="Remote User" />
							</div>
						)}
					</div>
				</div>

				{/* Chat Panel */}
				<div
					className={`fixed right-0 top-16 bottom-16 w-[400px] transform transition-transform duration-300 ${
						isChatOpen ? "translate-x-0" : "translate-x-full"
					}`}
				>
					<ChatPanel messages={chatMessages} socket={socket} roomId={roomId} />
				</div>
			</div>

			{/* Controls */}
			<Controls
				stream={stream}
				onToggleChat={toggleChat}
				isChatOpen={isChatOpen}
			/>
		</div>
	);
}
