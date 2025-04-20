import { RefObject, useEffect, useRef } from "react";

interface VideoPlayerProps {
	videoRef:
		| RefObject<HTMLVideoElement | null>
		| ((el: HTMLVideoElement | null) => void);
	stream?: MediaStream | null;
	isMuted?: boolean;
	isLocal?: boolean;
	label: string;
}

export default function VideoPlayer({
	videoRef,
	stream,
	isMuted = false,
	isLocal = false,
	label,
}: VideoPlayerProps) {
	const internalVideoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		const videoElement =
			typeof videoRef === "function"
				? internalVideoRef.current
				: videoRef.current;

		if (!videoElement) {
			console.log(`[${label}] Video element not found`);
			return;
		}

		const playVideo = async () => {
			try {
				if (videoElement.paused) {
					await videoElement.play();
					console.log(`[${label}] Video playing`);
				}
			} catch (err) {
				console.error(`[${label}] Error playing video:`, err);
			}
		};

		if (stream) {
			console.log(`[${label}] Setting up stream`, {
				streamActive: stream.active,
				trackCount: stream.getTracks().length,
				tracks: stream.getTracks().map((track) => ({
					kind: track.kind,
					enabled: track.enabled,
					muted: track.muted,
				})),
			});

			// Set the stream
			videoElement.srcObject = stream;
			videoElement.muted = isMuted;

			// Play when metadata is loaded
			const handleLoadedMetadata = () => {
				console.log(`[${label}] Video metadata loaded`);
				playVideo();
			};

			videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

			// Try to play immediately if metadata is already loaded
			if (videoElement.readyState >= 2) {
				playVideo();
			}

			return () => {
				videoElement.removeEventListener(
					"loadedmetadata",
					handleLoadedMetadata
				);
				videoElement.srcObject = null;
			};
		}
	}, [stream, label, isMuted, videoRef]);

	const handleVideoRef = (el: HTMLVideoElement | null) => {
		internalVideoRef.current = el;
		if (typeof videoRef === "function") {
			videoRef(el);
		}
	};

	return (
		<div className="relative w-full h-full bg-gray-800">
			<video
				ref={handleVideoRef}
				autoPlay
				playsInline
				muted={isMuted}
				className={`w-full h-full object-cover ${
					isLocal ? "scale-x-[-1]" : ""
				}`}
				style={{ minHeight: "300px", backgroundColor: "#1f2937" }}
			/>
			<div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-lg">
				<span className="text-white text-sm font-medium">{label}</span>
			</div>
		</div>
	);
}
