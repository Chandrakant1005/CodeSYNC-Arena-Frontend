import { io } from "socket.io-client";

let socket;

export function getSocket() {
  if (!socket) {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

    socket = io(socketUrl, {
      withCredentials: true
    });
  }

  return socket;
}
