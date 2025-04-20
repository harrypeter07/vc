import { RefObject } from "react";

interface VideoPlayerProps {
	videoRef: RefObject<HTMLVideoElement | null>;
	isMuted?: boolean;
	isLocal?: boolean;
	label: string;
}

export default function VideoPlayer({
	videoRef,
	isMuted = false,
	isLocal = false,
	label,
}: VideoPlayerProps) {
	return (
		<div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video">
			<video
				ref={videoRef}
				autoPlay
				playsInline
				muted={isMuted}
				className={`w-full h-full object-cover ${isLocal ? "mirror" : ""}`}
			/>
			<div className="absolute bottom-4 left-4 bg-black/40 px-3 py-1 rounded-lg">
				<span className="text-white text-sm font-medium">{label}</span>
			</div>
		</div>
	);
}
