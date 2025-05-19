"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
/* eslint-disable @typescript-eslint/no-unused-vars */
const server_1 = require("next/server");
function middleware(request) {
    const response = server_1.NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return response;
}
exports.config = {
    matcher: "/api/:path*",
};
