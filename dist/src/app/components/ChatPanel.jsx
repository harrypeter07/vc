"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ChatPanel;
const react_1 = require("react");
function ChatPanel({ messages, socket, roomId, }) {
    const [messageInput, setMessageInput] = (0, react_1.useState)("");
    const sendMessage = () => {
        if (!socket || !messageInput.trim())
            return;
        console.log("Sending chat message:", messageInput.trim());
        const chatData = {
            roomId,
            message: messageInput.trim(),
            sender: socket.id || "",
        };
        socket.emit("chat", chatData);
        setMessageInput("");
    };
    return (<div className="flex flex-col bg-white rounded-lg shadow-lg h-full">
			<div className="p-4 border-b border-gray-200">
				<h2 className="text-lg font-semibold text-gray-800">Meeting Chat</h2>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((msg, index) => (<div key={index} className={`flex ${msg.sender === (socket === null || socket === void 0 ? void 0 : socket.id) ? "justify-end" : "justify-start"}`}>
						<div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.sender === (socket === null || socket === void 0 ? void 0 : socket.id)
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-900"}`}>
							<p className="text-sm">{msg.message}</p>
							<p className="text-xs mt-1 opacity-75">
								{msg.sender === (socket === null || socket === void 0 ? void 0 : socket.id) ? "You" : "Remote User"}
							</p>
						</div>
					</div>))}
			</div>

			<div className="p-4 border-t border-gray-200">
				<div className="flex gap-2">
					<input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} placeholder="Type a message..." className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
					<button onClick={sendMessage} className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
						Send
					</button>
				</div>
			</div>
		</div>);
}
