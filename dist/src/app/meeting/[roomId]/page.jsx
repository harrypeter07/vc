"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MeetingPage;
const MeetingRoom_1 = __importDefault(require("@/app/components/MeetingRoom"));
const navigation_1 = require("next/navigation");
function MeetingPage() {
    const params = (0, navigation_1.useParams)();
    const searchParams = (0, navigation_1.useSearchParams)();
    const roomId = params.roomId;
    const email = searchParams.get("email");
    const password = searchParams.get("password");
    return (<main className="min-h-screen bg-gray-50">
      <MeetingRoom_1.default roomId={roomId} email={email} password={password}/>
    </main>);
}
