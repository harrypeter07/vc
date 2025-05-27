"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
	const [roomId, setRoomId] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [roomError, setRoomError] = useState("");
	const router = useRouter();

	// Helper to check if roomId is exactly 5 alphanumeric chars
	const isValidRoomId = (id: string) => /^[a-zA-Z0-9]{5}$/.test(id);

	// Helper to generate a random 5-character alphanumeric room ID
	const generateRoomId = () => {
		const chars =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		for (let i = 0; i < 5; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		setRoomId(result);
		setRoomError("");
	};

	const createRoom = () => {
		if (!isValidRoomId(roomId)) {
			setRoomError("Room code must be exactly 5 alphanumeric characters.");
			return;
		}
		setRoomError("");
		router.push(
			`/meeting/${roomId}?email=${encodeURIComponent(
				email
			)}&password=${encodeURIComponent(password)}`
		);
	};

	const joinRoom = (e: React.FormEvent) => {
		e.preventDefault();
		if (!isValidRoomId(roomId)) {
			setRoomError("Room code must be exactly 5 alphanumeric characters.");
			return;
		}
		setRoomError("");
		if (roomId.trim() && email.trim() && password.trim()) {
			router.push(
				`/meeting/${roomId}?email=${encodeURIComponent(
					email
				)}&password=${encodeURIComponent(password)}`
			);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50">
			<div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
				<div className="text-center">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						Video Chat App
					</h1>
					<p className="text-gray-600">
						Create a new room or join an existing one
					</p>
				</div>

				<div className="space-y-6">
					<div className="space-y-4">
						<div>
							<label htmlFor="room-id" className="sr-only">
								Room ID
							</label>
							<div className="flex gap-2">
								<input
									type="text"
									id="room-id"
									value={roomId}
									onChange={(e) => {
										setRoomId(e.target.value);
										setRoomError("");
									}}
									placeholder="Enter 5-char Room Code (e.g. ABC12)"
									className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									maxLength={5}
									required
								/>
								<button
									type="button"
									onClick={generateRoomId}
									className="px-3 py-2 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300 focus:outline-none"
									title="Generate random room code"
								>
									Generate
								</button>
							</div>
						</div>
						<div>
							<label htmlFor="email" className="sr-only">
								Email
							</label>
							<input
								type="email"
								id="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="Enter Email"
								className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>
						<div>
							<label htmlFor="password" className="sr-only">
								Password
							</label>
							<input
								type="password"
								id="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter Password"
								className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>
						{roomError && (
							<div className="text-red-500 text-sm mb-2">{roomError}</div>
						)}
						<button
							onClick={createRoom}
							className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							disabled={
								!isValidRoomId(roomId) || !email.trim() || !password.trim()
							}
						>
							Create New Room
						</button>
					</div>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-gray-300"></div>
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-2 bg-white text-gray-500">Or</span>
						</div>
					</div>

					<form onSubmit={joinRoom} className="space-y-4">
						<button
							type="submit"
							className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
							disabled={
								!isValidRoomId(roomId) || !email.trim() || !password.trim()
							}
						>
							Join Room
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
