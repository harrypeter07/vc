import { useState } from "react";
import { useRouter } from "next/navigation";

interface ControlsProps {
	stream: MediaStream | null;
	onToggleChat: () => void;
	isChatOpen: boolean;
	onVideoToggle: (enabled: boolean) => void;
	onAudioToggle: (enabled: boolean) => void;
}

export default function Controls({
	stream,
	onToggleChat,
	isChatOpen,
	onVideoToggle,
	onAudioToggle,
}: ControlsProps) {
	const [isVideoEnabled, setIsVideoEnabled] = useState(true);
	const [isAudioEnabled, setIsAudioEnabled] = useState(true);
	const router = useRouter();

	const handleVideoToggle = () => {
		const newState = !isVideoEnabled;
		setIsVideoEnabled(newState);
		onVideoToggle(newState);
	};

	const handleAudioToggle = () => {
		const newState = !isAudioEnabled;
		setIsAudioEnabled(newState);
		onAudioToggle(newState);
	};

	const endCall = () => {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
		}
		router.push("/");
	};

	return (
		<div className="fixed bottom-0 left-0 right-0 h-16 bg-white shadow-lg">
			<div className="max-w-screen-xl mx-auto h-full flex items-center justify-center gap-4 px-4">
				<button
					onClick={handleAudioToggle}
					className={`p-3 rounded-full ${
						isAudioEnabled
							? "bg-blue-500 hover:bg-blue-600"
							: "bg-red-500 hover:bg-red-600"
					}`}
				>
					<svg
						className="w-6 h-6 text-white"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						{isAudioEnabled ? (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
							/>
						) : (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
							/>
						)}
					</svg>
				</button>

				<button
					onClick={handleVideoToggle}
					className={`p-3 rounded-full ${
						isVideoEnabled
							? "bg-blue-500 hover:bg-blue-600"
							: "bg-red-500 hover:bg-red-600"
					}`}
				>
					<svg
						className="w-6 h-6 text-white"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						{isVideoEnabled ? (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						) : (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18"
							/>
						)}
					</svg>
				</button>

				<button
					onClick={onToggleChat}
					className={`p-3 rounded-full ${
						isChatOpen
							? "bg-blue-500 hover:bg-blue-600"
							: "bg-gray-600 hover:bg-gray-700"
					}`}
				>
					<svg
						className="w-6 h-6 text-white"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</button>

				<button
					onClick={endCall}
					className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
				>
					<svg
						className="w-6 h-6"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
						/>
					</svg>
				</button>
			</div>
		</div>
	);
}
