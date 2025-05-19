/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import SimplePeer from "simple-peer";
import VideoPlayer from "./VideoPlayer";
import ChatPanel from "./ChatPanel";
import Controls from "./Controls";
import type { SignalData, ChatData } from "@/lib/socket";
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

	const localVideoRef = useRef<HTMLVideoElement | null>(null);
	const peersRef = useRef<{ [key: string]: PeerData }>({});

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

				const newSocket = io("https://vc-production-bc1c.up.railway.app", {
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
						}
					}
				);

				newSocket.on("chat", ({ message, sender }: ChatData) => {
					console.log("Received chat message:", message, "from:", sender);
					setChatMessages((prev) => [...prev, { message, sender }]);
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
	}, [stream, roomId, email, password]);

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
			/>
		</div>
	);
}
