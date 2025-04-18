"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";

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

	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		// Initialize socket connection
		const socketInit = async () => {
			try {
				// If socket already exists, don't create a new one
				if (socketRef.current) {
					return;
				}

				await fetch("/api/socketio");
				const newSocket = io("http://localhost:3001", {
					path: "/api/socketio",
					transports: ["websocket"],
					reconnection: true,
					reconnectionAttempts: 3,
					reconnectionDelay: 1000,
					query: {
						userId: localStorage.getItem("userId") || Date.now().toString(),
					},
				});

				newSocket.on("connect", () => {
					console.log("Connected to Socket.IO server");
					localStorage.setItem("userId", newSocket.id);
					newSocket.emit("join-room", roomId);
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

		socket.on("user-connected", ({ userId, clientCount }) => {
			console.log("New user connected:", userId, "Total clients:", clientCount);
			setParticipantCount(clientCount);

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
		});

		socket.on("signal", ({ from, signal, type }) => {
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

				peer.signal(signal);
				setPeers((prev) => ({ ...prev, [from]: peer }));
			} else if (type === "answer") {
				console.log("Processing answer from:", from);
				const peer = peers[from];
				if (peer) {
					peer.signal(signal);
				}
			}
		});

		socket.on("user-disconnected", (userId) => {
			console.log("User disconnected:", userId);
			if (peers[userId]) {
				peers[userId].destroy();
				setPeers((prev) => {
					const newPeers = { ...prev };
					delete newPeers[userId];
					return newPeers;
				});
				setParticipantCount((prev) => Math.max(1, prev - 1));
			}
			if (remoteVideoRef.current && Object.keys(peers).length === 0) {
				remoteVideoRef.current.srcObject = null;
			}
		});

		socket.on("chat", ({ message, sender }) => {
			setChatMessages((prev) => [...prev, { message, sender }]);
		});

		return () => {
			socket.off("user-connected");
			socket.off("signal");
			socket.off("user-disconnected");
		};
	}, [socket, stream, roomId, peers]);

	const sendMessage = () => {
		if (!socket || !messageInput.trim()) return;

		socket.emit("chat", {
			roomId,
			message: messageInput,
			sender: socket.id,
		});
		setMessageInput("");
	};

	return (
		<div className="flex flex-col md:flex-row h-screen p-4 gap-4">
			<div className="flex-1 flex flex-col gap-4">
				<div className="bg-white p-4 rounded-lg shadow-sm">
					<h1 className="text-2xl font-semibold mb-2">Room: {roomId}</h1>
					<p className="text-gray-600">Participants: {participantCount}</p>
				</div>
				<div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
					<video
						ref={localVideoRef}
						autoPlay
						playsInline
						muted
						className="w-full h-full object-cover"
					/>
					<div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
						You
					</div>
				</div>
				<div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
					<video
						ref={remoteVideoRef}
						autoPlay
						playsInline
						className="w-full h-full object-cover"
					/>
					<div className="absolute bottom-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
						Remote
					</div>
				</div>
			</div>

			<div className="w-full md:w-80 flex flex-col bg-white rounded-lg shadow-sm p-4">
				<div className="flex-1 overflow-y-auto mb-4">
					{chatMessages.map((msg, index) => (
						<div
							key={index}
							className={`mb-2 ${
								msg.sender === socket?.id ? "text-right" : "text-left"
							}`}
						>
							<div
								className={`inline-block px-3 py-2 rounded-lg ${
									msg.sender === socket?.id
										? "bg-blue-500 text-white"
										: "bg-gray-100"
								}`}
							>
								{msg.message}
							</div>
						</div>
					))}
				</div>
				<div className="flex gap-2">
					<input
						type="text"
						value={messageInput}
						onChange={(e) => setMessageInput(e.target.value)}
						onKeyPress={(e) => e.key === "Enter" && sendMessage()}
						placeholder="Type a message..."
						className="flex-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<button
						onClick={sendMessage}
						className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}
