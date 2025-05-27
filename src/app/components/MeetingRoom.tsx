/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import SimplePeer from "simple-peer";
import VideoPlayer from "./VideoPlayer";
import ChatPanel from "./ChatPanel";
import Controls from "./Controls";
import { useRouter } from "next/navigation";

interface ChatMessage {
	message: string;
	sender: string;
}

interface PeerData {
	peer: SimplePeer.Instance;
	stream: MediaStream | undefined;
}

interface MeetingRoomProps {
	roomId: string;
	email: string;
	password: string;
}

// Use environment variable for the Socket.IO server URL (set NEXT_PUBLIC_SOCKET_SERVER_URL in your .env file)
const SOCKET_SERVER_URL =
	process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || "https://vc-i6e6.onrender.com";

// Inline types from server/socket.ts for client-side use
interface SignalData {
	to?: string;
	from: string;
	signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
	type: "offer" | "answer" | "screen-offer" | "screen-answer";
}

interface ChatData {
	roomId: string;
	message: string;
	sender: string;
}

export default function MeetingRoom({
	roomId,
	email,
	password,
}: MeetingRoomProps) {
	const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
	const socketRef = useRef<ReturnType<typeof io> | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [peers, setPeers] = useState<{ [key: string]: PeerData }>({});
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [participantCount, setParticipantCount] = useState(1);
	const [error, setError] = useState<string | null>(null);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [disconnectMsg, setDisconnectMsg] = useState<string | null>(null);
	const [roomFullMsg, setRoomFullMsg] = useState<string | null>(null);
	const [isScreenSharing, setIsScreenSharing] = useState(false);
	const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
	const [screenPeers, setScreenPeers] = useState<{ [key: string]: PeerData }>(
		{}
	);
	const screenPeersRef = useRef<{ [key: string]: PeerData }>({});

	const localVideoRef = useRef<HTMLVideoElement | null>(null);
	const peersRef = useRef<{ [key: string]: PeerData }>({});
	const router = useRouter();

	// Add a ref for the local screen share video
	const localScreenVideoRef = useRef<HTMLVideoElement | null>(null);

	const [callState, setCallState] = useState<
		"waiting" | "can-call" | "incoming" | "accepted"
	>("waiting");

	// Initialize media stream
	useEffect(() => {
		const initStream = async () => {
			try {
				const mediaStream = await navigator.mediaDevices.getUserMedia({
					video: {
						width: { ideal: 1280 },
						height: { ideal: 720 },
						facingMode: "user",
					},
					audio: true,
				});

				// Enable all tracks explicitly
				mediaStream.getTracks().forEach((track) => {
					track.enabled = true;
					console.log(`Track enabled: ${track.kind}`, track.enabled);
				});

				// Set stream to state
				setStream(mediaStream);

				// Directly set stream to local video element
				if (localVideoRef.current) {
					console.log("Attaching stream to local video element");

					// Remove any existing stream first
					if (localVideoRef.current.srcObject) {
						localVideoRef.current.srcObject = null;
					}

					// Wait a bit before setting new stream
					await new Promise((resolve) => setTimeout(resolve, 100));

					localVideoRef.current.srcObject = mediaStream;

					// Handle loadedmetadata event
					const handleLoadedMetadata = async () => {
						try {
							// Only attempt to play if video is paused
							if (localVideoRef.current?.paused) {
								await localVideoRef.current.play();
								console.log("Local video playing after metadata loaded");
							}
						} catch (err) {
							console.error("Error playing local video:", err);
						}
					};

					// Add event listener for loadedmetadata
					localVideoRef.current.addEventListener(
						"loadedmetadata",
						handleLoadedMetadata
					);

					// Cleanup function to remove event listener
					return () => {
						localVideoRef.current?.removeEventListener(
							"loadedmetadata",
							handleLoadedMetadata
						);
					};
				} else {
					console.error("Local video element not found");
				}
			} catch (err) {
				console.error("Failed to get media stream:", err);
				setError("Failed to access camera and microphone");
			}
		};

		initStream();

		return () => {
			if (stream) {
				stream.getTracks().forEach((track) => {
					track.stop();
					console.log(`Track stopped: ${track.kind}`);
				});
			}
			if (localVideoRef.current) {
				localVideoRef.current.srcObject = null;
			}
		};
	}, []); // Empty dependency array as we only want this to run once

	// Initialize socket connection
	useEffect(() => {
		if (!stream || isConnecting) return;

		const initSocket = async () => {
			try {
				setIsConnecting(true);

				const newSocket = io(SOCKET_SERVER_URL, {
					path: "/socketio",
					transports: ["websocket"],
					autoConnect: false,
					query: { email, roomId },
				});

				socketRef.current = newSocket;
				setSocket(newSocket);

				newSocket.on("connect", () => {
					console.log("Socket connected:", newSocket.id);
					newSocket.emit("join-room", { roomId, email, password });
				});

				newSocket.on(
					"user-connected",
					({
						userId,
						clientCount,
					}: {
						userId: string;
						clientCount: number;
					}) => {
						console.log("User connected:", userId);
						setParticipantCount(clientCount);

						if (userId !== newSocket.id && stream) {
							const peer = new SimplePeer({
								initiator: true,
								stream,
								trickle: false,
							});

							peer.on("signal", (data) => {
								newSocket.emit("signal", {
									to: userId,
									from: newSocket.id,
									signal: data,
									type: "offer",
								});
							});

							peer.on("stream", (remoteStream) => {
								setPeers((prev) => ({
									...prev,
									[userId]: { ...prev[userId], stream: remoteStream },
								}));
							});

							peersRef.current[userId] = { peer, stream: undefined };
							setPeers((prev) => ({
								...prev,
								[userId]: { peer, stream: undefined },
							}));
						}
					}
				);

				newSocket.on("signal", ({ from, signal, type }: SignalData) => {
					if (type === "offer" && stream) {
						const peer = new SimplePeer({
							initiator: false,
							stream,
							trickle: false,
						});

						peer.on("signal", (data) => {
							newSocket.emit("signal", {
								to: from,
								from: newSocket.id,
								signal: data,
								type: "answer",
							});
						});

						peer.on("stream", (remoteStream) => {
							setPeers((prev) => ({
								...prev,
								[from]: { ...prev[from], stream: remoteStream },
							}));
						});

						peer.signal(signal as any);
						peersRef.current[from] = { peer, stream: undefined };
						setPeers((prev) => ({
							...prev,
							[from]: { peer, stream: undefined },
						}));
					} else if (type === "answer") {
						peersRef.current[from]?.peer.signal(signal as any);
					}
				});

				newSocket.on(
					"user-disconnected",
					({
						userId,
						clientCount,
					}: {
						userId: string;
						clientCount: number;
					}) => {
						console.log("User disconnected:", userId);
						setParticipantCount(clientCount);

						if (peersRef.current[userId]) {
							peersRef.current[userId].peer.destroy();
							delete peersRef.current[userId];
							setPeers((prev) => {
								const newPeers = { ...prev };
								delete newPeers[userId];
								return newPeers;
							});
							setDisconnectMsg("Peer has left the room.");
						}
					}
				);

				newSocket.on("chat", ({ message, sender }: ChatData) => {
					console.log("Received chat message:", message, "from:", sender);
					setChatMessages((prev) => [...prev, { message, sender }]);
				});

				newSocket.on("room-full", (data: { message: string }) => {
					setRoomFullMsg(
						data.message || "This room is full. Maximum 2 participants allowed."
					);
					setTimeout(() => {
						setRoomFullMsg(null);
						router.push("/");
					}, 3000);
				});

				newSocket.connect();
			} catch (err) {
				console.error("Socket initialization failed:", err);
				setError("Failed to connect to the room");
			} finally {
				setIsConnecting(false);
			}
		};

		initSocket();

		return () => {
			if (socketRef.current) {
				socketRef.current.disconnect();
			}
			Object.values(peersRef.current).forEach(({ peer }) => peer.destroy());
			peersRef.current = {};
		};
	}, [stream, roomId, email, password, router]);

	const toggleChat = () => {
		setIsChatOpen(!isChatOpen);
	};

	const toggleVideo = (enabled: boolean) => {
		if (stream) {
			stream.getVideoTracks().forEach((track) => {
				track.enabled = enabled;
			});

			// Update all peer connections with the new track state
			Object.values(peersRef.current).forEach(({ peer }) => {
				if (peer) {
					const videoSender = peer.streams[0]?.getVideoTracks()[0];
					if (videoSender) {
						videoSender.enabled = enabled;
					}
				}
			});
		}
	};

	const toggleAudio = (enabled: boolean) => {
		if (stream) {
			stream.getAudioTracks().forEach((track) => {
				track.enabled = enabled;
			});

			// Update all peer connections with the new track state
			Object.values(peersRef.current).forEach(({ peer }) => {
				if (peer) {
					const audioSender = peer.streams[0]?.getAudioTracks()[0];
					if (audioSender) {
						audioSender.enabled = enabled;
					}
				}
			});
		}
	};

	// Screen sharing logic
	const startScreenShare = async () => {
		try {
			const displayStream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: false, // usually no audio for screen share
			});
			setScreenStream(displayStream);
			setIsScreenSharing(true);

			Object.keys(peersRef.current).forEach((userId) => {
				const peer = new SimplePeer({
					initiator: true,
					stream: displayStream,
					trickle: false,
				});
				peer.on("signal", (data) => {
					if (socketRef.current) {
						socketRef.current.emit("screen-signal", {
							to: userId,
							from: socketRef.current.id,
							signal: data,
							type: "screen-offer",
						});
					}
				});
				peer.on("stream", (remoteScreenStream) => {
					setScreenPeers((prev) => ({
						...prev,
						[userId]: {
							...prev[userId],
							stream: remoteScreenStream || undefined,
						},
					}));
				});
				screenPeersRef.current[userId] = { peer, stream: undefined };
				setScreenPeers((prev) => ({
					...prev,
					[userId]: { peer, stream: undefined },
				}));
			});

			displayStream.getVideoTracks()[0].onended = () => {
				stopScreenShare();
			};
		} catch (err) {
			console.error("Failed to start screen sharing:", err);
		}
	};

	const stopScreenShare = () => {
		if (screenStream) {
			screenStream.getTracks().forEach((track) => track.stop());
		}
		setIsScreenSharing(false);
		setScreenStream(null);
		Object.values(screenPeersRef.current).forEach(({ peer }) => peer.destroy());
		screenPeersRef.current = {};
		setScreenPeers({});
	};

	const handleScreenShareToggle = (enabled: boolean) => {
		if (enabled) {
			startScreenShare();
		} else {
			stopScreenShare();
		}
	};

	// Listen for screen-signal events
	useEffect(() => {
		if (!socketRef.current) return;
		const socket = socketRef.current;
		const handleScreenSignal = ({ from, signal, type }: SignalData) => {
			if (type === "screen-offer") {
				const peer = new SimplePeer({
					initiator: false,
					stream: undefined,
					trickle: false,
				});
				peer.on("signal", (data) => {
					socket.emit("screen-signal", {
						to: from,
						from: socket.id,
						signal: data,
						type: "screen-answer",
					});
				});
				peer.on("stream", (remoteScreenStream) => {
					setScreenPeers((prev) => ({
						...prev,
						[from]: { ...prev[from], stream: remoteScreenStream || undefined },
					}));
				});
				peer.signal(signal as any);
				screenPeersRef.current[from] = { peer, stream: undefined };
				setScreenPeers((prev) => ({
					...prev,
					[from]: { peer, stream: undefined },
				}));
			} else if (type === "screen-answer") {
				screenPeersRef.current[from]?.peer.signal(signal as any);
			}
		};
		socket.on("screen-signal", handleScreenSignal);
		return () => {
			socket.off("screen-signal", handleScreenSignal);
		};
	}, [socketRef.current]);

	// Clean up screen share on unmount
	useEffect(() => {
		return () => {
			stopScreenShare();
		};
	}, []);

	// Set srcObject for local screen share video
	useEffect(() => {
		if (isScreenSharing && screenStream && localScreenVideoRef.current) {
			localScreenVideoRef.current.srcObject = screenStream;
		}
		if (!isScreenSharing && localScreenVideoRef.current) {
			localScreenVideoRef.current.srcObject = null;
		}
	}, [isScreenSharing, screenStream]);

	// Track participants to determine call state
	useEffect(() => {
		if (participantCount === 1) {
			setCallState("waiting");
		} else if (participantCount === 2 && callState === "waiting") {
			// If second user joins, allow to call
			setCallState("can-call");
		}
	}, [participantCount]);

	// Call signaling handlers
	useEffect(() => {
		if (!socketRef.current) return;
		const socket = socketRef.current;
		const handleCallIncoming = () => {
			setCallState("incoming");
		};
		const handleCallAccepted = () => {
			setCallState("accepted");
		};
		socket.on("call-incoming", handleCallIncoming);
		socket.on("call-accepted", handleCallAccepted);
		return () => {
			socket.off("call-incoming", handleCallIncoming);
			socket.off("call-accepted", handleCallAccepted);
		};
	}, [socketRef.current]);

	const handleCallNow = () => {
		if (socketRef.current) {
			socketRef.current.emit("call-initiate", {
				roomId,
				from: socketRef.current.id,
			});
			setCallState("waiting"); // Wait for accept
		}
	};

	const handleAcceptCall = () => {
		if (socketRef.current) {
			socketRef.current.emit("call-accept", {
				roomId,
				from: socketRef.current.id,
			});
			setCallState("accepted");
		}
	};

	// Only allow peer connection setup if callState is 'accepted'
	const canConnect = callState === "accepted";

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
			<div className="absolute top-0 left-0 right-0 h-16 bg-gray-800 flex items-center px-6 z-10">
				<div className="flex items-center space-x-4">
					<h1 className="text-white font-medium">Room: {roomId}</h1>
					<span className="text-gray-400">|</span>
					<p className="text-gray-300">Participants: {participantCount}/2</p>
				</div>
			</div>

			<div className="h-full pt-16 pb-16 flex">
				<div
					className={`flex-1 p-4 ${
						isChatOpen ? "pr-[400px]" : ""
					} transition-all duration-300`}
				>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
						<div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]">
							<div className="relative w-full h-full">
								<video
									ref={localVideoRef}
									autoPlay
									playsInline
									muted
									className="w-full h-full object-cover scale-x-[-1]"
									style={{ minHeight: "300px", backgroundColor: "#1f2937" }}
								/>
								<div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-lg">
									<span className="text-white text-sm font-medium">
										You ({email})
									</span>
								</div>
							</div>
						</div>
						{/* Show local screen share if active */}
						{isScreenSharing && screenStream && (
							<div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]">
								<video
									autoPlay
									playsInline
									muted
									ref={localScreenVideoRef}
									className="w-full h-full object-cover"
									style={{ minHeight: "300px", backgroundColor: "#1f2937" }}
								/>
								<div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-lg">
									<span className="text-green-400 text-sm font-medium">
										You (Screen Sharing)
									</span>
								</div>
							</div>
						)}
						{/* Show remote webcam streams */}
						{Object.entries(peers).map(([userId, { stream: remoteStream }]) => (
							<div
								key={userId}
								className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]"
							>
								<VideoPlayer
									videoRef={() => {
										if (peersRef.current[userId]) {
											const currentPeer = peersRef.current[userId].peer;
											peersRef.current[userId] = {
												peer: currentPeer,
												stream: remoteStream,
											};
										}
									}}
									stream={remoteStream}
									isMuted={false}
									isLocal={false}
									label={`Peer ${userId.slice(0, 8)}`}
								/>
							</div>
						))}
						{/* Show remote screen share streams */}
						{Object.entries(screenPeers)
							.filter(
								([, { stream: remoteScreenStream }]) =>
									remoteScreenStream !== undefined &&
									remoteScreenStream !== null
							)
							.map(([userId, { stream: remoteScreenStream }]) => (
								<div
									key={userId + "-screen"}
									className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]"
								>
									<VideoPlayer
										videoRef={() => {
											if (screenPeersRef.current[userId]) {
												const currentPeer = screenPeersRef.current[userId].peer;
												screenPeersRef.current[userId] = {
													peer: currentPeer,
													stream: (remoteScreenStream ||
														undefined) as MediaStream,
												};
											}
										}}
										stream={(remoteScreenStream || undefined) as MediaStream}
										isMuted={true}
										isLocal={false}
										label={`Peer ${userId.slice(0, 8)} (Screen)`}
									/>
								</div>
							))}
					</div>
				</div>

				<div
					className={`fixed right-0 top-16 bottom-16 w-[400px] transform transition-transform duration-300 ${
						isChatOpen ? "translate-x-0" : "translate-x-full"
					}`}
				>
					<ChatPanel messages={chatMessages} socket={socket} roomId={roomId} />
				</div>
			</div>

			<Controls
				stream={stream}
				onToggleChat={toggleChat}
				isChatOpen={isChatOpen}
				onVideoToggle={toggleVideo}
				onAudioToggle={toggleAudio}
				onScreenShareToggle={handleScreenShareToggle}
				isScreenSharing={isScreenSharing}
			/>

			{disconnectMsg && (
				<div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
					{disconnectMsg}
				</div>
			)}

			{roomFullMsg && (
				<div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded shadow-lg z-50">
					{roomFullMsg}
				</div>
			)}

			{/* Call signaling UI */}
			{callState === "waiting" && (
				<div className="flex items-center justify-center h-full">
					<p className="text-xl text-gray-300">Call not started yet.</p>
				</div>
			)}
			{callState === "can-call" && (
				<div className="flex items-center justify-center h-full">
					<button
						onClick={handleCallNow}
						className="px-6 py-3 bg-green-600 text-white rounded-lg text-lg font-semibold shadow hover:bg-green-700"
					>
						Call Now
					</button>
				</div>
			)}
			{callState === "incoming" && (
				<div className="flex items-center justify-center h-full">
					<p className="text-xl text-gray-300 mr-4">Incoming call...</p>
					<button
						onClick={handleAcceptCall}
						className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold shadow hover:bg-blue-700"
					>
						Accept Call
					</button>
				</div>
			)}
			{/* Only show the rest of the meeting UI if callState is 'accepted' */}
			{canConnect && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
					<div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]">
						<div className="relative w-full h-full">
							<video
								ref={localVideoRef}
								autoPlay
								playsInline
								muted
								className="w-full h-full object-cover scale-x-[-1]"
								style={{ minHeight: "300px", backgroundColor: "#1f2937" }}
							/>
							<div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-lg">
								<span className="text-white text-sm font-medium">
									You ({email})
								</span>
							</div>
						</div>
					</div>
					{/* Show local screen share if active */}
					{isScreenSharing && screenStream && (
						<div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]">
							<video
								autoPlay
								playsInline
								muted
								ref={localScreenVideoRef}
								className="w-full h-full object-cover"
								style={{ minHeight: "300px", backgroundColor: "#1f2937" }}
							/>
							<div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-lg">
								<span className="text-green-400 text-sm font-medium">
									You (Screen Sharing)
								</span>
							</div>
						</div>
					)}
					{/* Show remote webcam streams */}
					{Object.entries(peers).map(([userId, { stream: remoteStream }]) => (
						<div
							key={userId}
							className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]"
						>
							<VideoPlayer
								videoRef={() => {
									if (peersRef.current[userId]) {
										const currentPeer = peersRef.current[userId].peer;
										peersRef.current[userId] = {
											peer: currentPeer,
											stream: remoteStream,
										};
									}
								}}
								stream={remoteStream}
								isMuted={false}
								isLocal={false}
								label={`Peer ${userId.slice(0, 8)}`}
							/>
						</div>
					))}
					{/* Show remote screen share streams */}
					{Object.entries(screenPeers)
						.filter(
							([, { stream: remoteScreenStream }]) =>
								remoteScreenStream !== undefined && remoteScreenStream !== null
						)
						.map(([userId, { stream: remoteScreenStream }]) => (
							<div
								key={userId + "-screen"}
								className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]"
							>
								<VideoPlayer
									videoRef={() => {
										if (screenPeersRef.current[userId]) {
											const currentPeer = screenPeersRef.current[userId].peer;
											screenPeersRef.current[userId] = {
												peer: currentPeer,
												stream: (remoteScreenStream ||
													undefined) as MediaStream,
											};
										}
									}}
									stream={(remoteScreenStream || undefined) as MediaStream}
									isMuted={true}
									isLocal={false}
									label={`Peer ${userId.slice(0, 8)} (Screen)`}
								/>
							</div>
						))}
				</div>
			)}
		</div>
	);
}
