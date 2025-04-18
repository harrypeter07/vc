"use client";

import MeetingRoom from "@/app/components/MeetingRoom";
import { useParams } from "next/navigation";

export default function MeetingPage() {
	const params = useParams();
	const roomId = params.roomId as string;

	return (
		<main className="min-h-screen bg-gray-50">
			<MeetingRoom roomId={roomId} />
		</main>
	);
}
