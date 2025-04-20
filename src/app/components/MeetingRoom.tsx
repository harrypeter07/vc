
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

interface PeerData {
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
}

interface MeetingRoomProps {
  roomId: string;
  email: string;
  password: string;
}

export default function MeetingRoom({ roomId, email, password }: MeetingRoomProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [peers, setPeers] = useState<{ [key: string]: PeerData }>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const router = useRouter();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    let isMounted = true;

    const socketInit = async () => {
      try {
        if (socketRef.current) {
          console.log("Socket already exists, reusing connection");
          return;
        }

        console.log("Initializing new socket connection...");
        await fetch("/api/socketio");
        const newSocket = io(`http://localhost:${process.env.NEXT_PUBLIC_SOCKET_PORT || 3001}`, {
          path: "/api/socketio",
          transports: ["websocket"],
          reconnection: false, // Disable reconnection to prevent duplicates
          query: {
            userId: Date.now().toString(), // Use fresh userId to avoid reconnection issues
          },
        });

        socketRef.current = newSocket;
        if (isMounted) {
          setSocket(newSocket);
        }

        newSocket.on("connect", () => {
          console.log("Connected to Socket.IO server with ID:", newSocket.id);
          newSocket.emit("join-room", { roomId, email, password });
        });

        newSocket.on("join-error", ({ message }) => {
          console.log("Join error:", message);
          if (isMounted) {
            setError(message);
            setTimeout(() => {
              router.push("/");
            }, 3000);
          }
        });

        newSocket.on("room-full", ({ message }) => {
          console.log("Room is full:", message);
          if (isMounted) {
            setError(message);
            setTimeout(() => {
              router.push("/");
            }, 3000);
          }
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
          if (isMounted) {
            setError("Failed to connect to the server. Please try again.");
          }
        });
      } catch (error) {
        console.error("Failed to initialize socket:", error);
        if (isMounted) {
          setError("Failed to initialize connection. Please try again.");
        }
      }
    };

    socketInit();

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((mediaStream) => {
        if (isMounted) {
          setStream(mediaStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = mediaStream;
          }
        }
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
        if (isMounted) {
          setError("Failed to access camera or microphone. Please check permissions.");
        }
      });

    return () => {
      isMounted = false;
      console.log("Cleaning up MeetingRoom...");
      // Clean up Socket.IO
      if (socketRef.current) {
        socketRef.current.emit("leave-room", { roomId });
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        console.log("Socket disconnected and cleaned up");
      }

      // Clean up media stream
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        setStream(null);
        console.log("Media stream stopped");
      }

      // Clean up WebRTC peers
      Object.values(peers).forEach(({ peer }) => {
        peer.destroy();
      });
      setPeers({});
      console.log("WebRTC peers destroyed");

      // Clear video refs
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      Object.keys(remoteVideoRefs.current).forEach((key) => {
        if (remoteVideoRefs.current[key]) {
          remoteVideoRefs.current[key]!.srcObject = null;
        }
      });
      remoteVideoRefs.current = {};
      console.log("Video references cleared");

      // Clear local storage
      localStorage.removeItem("userId");
      console.log("Local storage cleared");
    };
  }, [roomId, email, password]);

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

      if (userId !== socket.id && !peers[userId]) {
        const peer = new SimplePeer({
          initiator: true,
          stream,
          trickle: false,
          config: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          },
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
          setPeers((prev) => ({
            ...prev,
            [userId]: { ...prev[userId], stream: remoteStream },
          }));
        });

        peer.on("error", (err) => console.error("Peer error:", err));

        setPeers((prev) => ({
          ...prev,
          [userId]: { peer, stream: null },
        }));
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

      existingPeers.forEach((peerId) => {
        if (!peers[peerId]) {
          const peer = new SimplePeer({
            initiator: false,
            stream,
            trickle: false,
            config: {
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            },
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
            setPeers((prev) => ({
              ...prev,
              [peerId]: { ...prev[peerId], stream: remoteStream },
            }));
          });

          peer.on("error", (err) => console.error("Peer error:", err));

          setPeers((prev) => ({
            ...prev,
            [peerId]: { peer, stream: null },
          }));
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
          config: {
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          },
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
          setPeers((prev) => ({
            ...prev,
            [from]: { ...prev[from], stream: remoteStream },
          }));
        });

        peer.on("error", (err) => console.error("Peer error:", err));

        peer.signal(signal as string);
        setPeers((prev) => ({
          ...prev,
          [from]: { peer, stream: null },
        }));
      } else if (type === "answer") {
        console.log("Processing answer from:", from);
        const peerData = peers[from];
        if (peerData) {
          peerData.peer.signal(signal as string);
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
        peers[userId].peer.destroy();
        setPeers((prev) => {
          const newPeers = { ...prev };
          delete newPeers[userId];
          return newPeers;
        });
      }
      setParticipantCount(clientCount);
    };

    const handleChat = ({
      message,
      sender,
    }: {
      message: string;
      sender: string;
    }) => {
      console.log("Received chat message:", message, "from:", sender);
      setChatMessages((prev) => {
        if (prev.some((msg) => msg.message === message && msg.sender === sender)) {
          return prev;
        }
        return [...prev, { message, sender }];
      });
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
  }, [socket, stream, roomId, peers]);

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
            <div className="relative">
              <VideoPlayer
                videoRef={localVideoRef}
                stream={stream}
                isMuted={true}
                isLocal={true}
                label="You"
              />
            </div>
            {Object.entries(peers).map(([userId, { stream: remoteStream }]) => (
              <div key={userId} className="relative">
                <VideoPlayer
                  videoRef={(el) => (remoteVideoRefs.current[userId] = el)}
                  stream={remoteStream}
                  label={`User ${userId.slice(0, 8)}`}
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
      />
    </div>
  );
}
