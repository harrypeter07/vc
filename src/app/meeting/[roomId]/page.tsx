
"use client";

import MeetingRoom from "@/app/components/MeetingRoom";
import { useParams, useSearchParams } from "next/navigation";

export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const email = searchParams.get("email") as string;
  const password = searchParams.get("password") as string;

  return (
    <main className="min-h-screen bg-gray-50">
      <MeetingRoom roomId={roomId} email={email} password={password} />
    </main>
  );
}
