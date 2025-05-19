"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MeetingRoom;
const react_1 = require("react");
const socket_io_client_1 = require("socket.io-client");
const simple_peer_1 = __importDefault(require("simple-peer"));
const VideoPlayer_1 = __importDefault(require("./VideoPlayer"));
const ChatPanel_1 = __importDefault(require("./ChatPanel"));
const Controls_1 = __importDefault(require("./Controls"));
function MeetingRoom({ roomId, email, password, }) {
    const [socket, setSocket] = (0, react_1.useState)(null);
    const socketRef = (0, react_1.useRef)(null);
    const [isConnecting, setIsConnecting] = (0, react_1.useState)(false);
    const [peers, setPeers] = (0, react_1.useState)({});
    const [stream, setStream] = (0, react_1.useState)(null);
    const [chatMessages, setChatMessages] = (0, react_1.useState)([]);
    const [participantCount, setParticipantCount] = (0, react_1.useState)(1);
    const [error, setError] = (0, react_1.useState)(null);
    const [isChatOpen, setIsChatOpen] = (0, react_1.useState)(false);
    const localVideoRef = (0, react_1.useRef)(null);
    const peersRef = (0, react_1.useRef)({});
    // Initialize media stream
    (0, react_1.useEffect)(() => {
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
                        var _a;
                        try {
                            // Only attempt to play if video is paused
                            if ((_a = localVideoRef.current) === null || _a === void 0 ? void 0 : _a.paused) {
                                await localVideoRef.current.play();
                                console.log("Local video playing after metadata loaded");
                            }
                        }
                        catch (err) {
                            console.error("Error playing local video:", err);
                        }
                    };
                    // Add event listener for loadedmetadata
                    localVideoRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
                    // Cleanup function to remove event listener
                    return () => {
                        var _a;
                        (_a = localVideoRef.current) === null || _a === void 0 ? void 0 : _a.removeEventListener("loadedmetadata", handleLoadedMetadata);
                    };
                }
                else {
                    console.error("Local video element not found");
                }
            }
            catch (err) {
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
    (0, react_1.useEffect)(() => {
        if (!stream || isConnecting)
            return;
        const initSocket = async () => {
            try {
                setIsConnecting(true);
                const newSocket = (0, socket_io_client_1.io)("https://vc-production-bc1c.up.railway.app", {
                    path: "/api/socketio",
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
                newSocket.on("user-connected", ({ userId, clientCount }) => {
                    console.log("User connected:", userId);
                    setParticipantCount(clientCount);
                    if (userId !== newSocket.id && stream) {
                        const peer = new simple_peer_1.default({
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
                            setPeers((prev) => (Object.assign(Object.assign({}, prev), { [userId]: Object.assign(Object.assign({}, prev[userId]), { stream: remoteStream }) })));
                        });
                        peersRef.current[userId] = { peer, stream: undefined };
                        setPeers((prev) => (Object.assign(Object.assign({}, prev), { [userId]: { peer, stream: undefined } })));
                    }
                });
                newSocket.on("signal", ({ from, signal, type }) => {
                    var _a;
                    if (type === "offer" && stream) {
                        const peer = new simple_peer_1.default({
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
                            setPeers((prev) => (Object.assign(Object.assign({}, prev), { [from]: Object.assign(Object.assign({}, prev[from]), { stream: remoteStream }) })));
                        });
                        peer.signal(signal);
                        peersRef.current[from] = { peer, stream: undefined };
                        setPeers((prev) => (Object.assign(Object.assign({}, prev), { [from]: { peer, stream: undefined } })));
                    }
                    else if (type === "answer") {
                        (_a = peersRef.current[from]) === null || _a === void 0 ? void 0 : _a.peer.signal(signal);
                    }
                });
                newSocket.on("user-disconnected", ({ userId, clientCount }) => {
                    console.log("User disconnected:", userId);
                    setParticipantCount(clientCount);
                    if (peersRef.current[userId]) {
                        peersRef.current[userId].peer.destroy();
                        delete peersRef.current[userId];
                        setPeers((prev) => {
                            const newPeers = Object.assign({}, prev);
                            delete newPeers[userId];
                            return newPeers;
                        });
                    }
                });
                newSocket.on("chat", ({ message, sender }) => {
                    console.log("Received chat message:", message, "from:", sender);
                    setChatMessages((prev) => [...prev, { message, sender }]);
                });
                newSocket.connect();
            }
            catch (err) {
                console.error("Socket initialization failed:", err);
                setError("Failed to connect to the room");
            }
            finally {
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
    const toggleVideo = (enabled) => {
        if (stream) {
            stream.getVideoTracks().forEach((track) => {
                track.enabled = enabled;
            });
            // Update all peer connections with the new track state
            Object.values(peersRef.current).forEach(({ peer }) => {
                var _a;
                if (peer) {
                    const videoSender = (_a = peer.streams[0]) === null || _a === void 0 ? void 0 : _a.getVideoTracks()[0];
                    if (videoSender) {
                        videoSender.enabled = enabled;
                    }
                }
            });
        }
    };
    const toggleAudio = (enabled) => {
        if (stream) {
            stream.getAudioTracks().forEach((track) => {
                track.enabled = enabled;
            });
            // Update all peer connections with the new track state
            Object.values(peersRef.current).forEach(({ peer }) => {
                var _a;
                if (peer) {
                    const audioSender = (_a = peer.streams[0]) === null || _a === void 0 ? void 0 : _a.getAudioTracks()[0];
                    if (audioSender) {
                        audioSender.enabled = enabled;
                    }
                }
            });
        }
    };
    if (error) {
        return (<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
				<div className="bg-white p-6 rounded-lg shadow-xl">
					<h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
					<p className="text-gray-700 mb-4">{error}</p>
					<p className="text-gray-500">Redirecting to home page...</p>
				</div>
			</div>);
    }
    return (<div className="relative h-screen bg-gray-900">
			<div className="absolute top-0 left-0 right-0 h-16 bg-gray-800 flex items-center px-6 z-10">
				<div className="flex items-center space-x-4">
					<h1 className="text-white font-medium">Room: {roomId}</h1>
					<span className="text-gray-400">|</span>
					<p className="text-gray-300">Participants: {participantCount}/2</p>
				</div>
			</div>

			<div className="h-full pt-16 pb-16 flex">
				<div className={`flex-1 p-4 ${isChatOpen ? "pr-[400px]" : ""} transition-all duration-300`}>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
						<div className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]">
							<div className="relative w-full h-full">
								<video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" style={{ minHeight: "300px", backgroundColor: "#1f2937" }}/>
								<div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-lg">
									<span className="text-white text-sm font-medium">
										You ({email})
									</span>
								</div>
							</div>
						</div>
						{Object.entries(peers).map(([userId, { stream: remoteStream }]) => (<div key={userId} className="relative bg-gray-800 rounded-lg overflow-hidden min-h-[300px]">
								<VideoPlayer_1.default videoRef={() => {
                if (peersRef.current[userId]) {
                    const currentPeer = peersRef.current[userId].peer;
                    peersRef.current[userId] = {
                        peer: currentPeer,
                        stream: remoteStream,
                    };
                }
            }} stream={remoteStream} isMuted={false} isLocal={false} label={`Peer ${userId.slice(0, 8)}`}/>
							</div>))}
					</div>
				</div>

				<div className={`fixed right-0 top-16 bottom-16 w-[400px] transform transition-transform duration-300 ${isChatOpen ? "translate-x-0" : "translate-x-full"}`}>
					<ChatPanel_1.default messages={chatMessages} socket={socket} roomId={roomId}/>
				</div>
			</div>

			<Controls_1.default stream={stream} onToggleChat={toggleChat} isChatOpen={isChatOpen} onVideoToggle={toggleVideo} onAudioToggle={toggleAudio}/>
		</div>);
}
