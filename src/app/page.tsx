"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
	const [roomId, setRoomId] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const router = useRouter();

	const createRoom = () => {
		const newRoomId = Math.random().toString(36).substring(2, 12);
		router.push(
			`/meeting/${newRoomId}?email=${encodeURIComponent(
				email
			)}&password=${encodeURIComponent(password)}`
		);
	};

	const joinRoom = (e: React.FormEvent) => {
		e.preventDefault();
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
						<button
							onClick={createRoom}
							className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
							disabled={!email.trim() || !password.trim()}
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
						<div>
							<label htmlFor="room-id" className="sr-only">
								Room ID
							</label>
							<input
								type="text"
								id="room-id"
								value={roomId}
								onChange={(e) => setRoomId(e.target.value)}
								placeholder="Enter Room ID"
								className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>
						<div>
							<label htmlFor="join-email" className="sr-only">
								Email
							</label>
							<input
								type="email"
								id="join-email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="Enter Email"
								className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>
						<div>
							<label htmlFor="join-password" className="sr-only">
								Password
							</label>
							<input
								type="password"
								id="join-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter Password"
								className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								required
							/>
						</div>
						<button
							type="submit"
							className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
						>
							Join Room
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
