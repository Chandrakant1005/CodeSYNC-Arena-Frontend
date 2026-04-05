import { useEffect, useRef } from "react";

export default function ChatPanel({
  messages,
  draftMessage,
  setDraftMessage,
  onSend,
  notifications,
  onApproveWhiteboardRequest
}) {
  const messagesRef = useRef(null);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-column">
      <div className="panel-card notice-panel">
        <div className="panel-header">
          <h3>Meeting notes</h3>
          <span>Owner alerts</span>
        </div>
        <div className="notice-stack">
          {notifications.length ? (
            notifications.map((notification) => (
              <div key={notification.id} className="notice-item">
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                {notification.type === "whiteboard-request" ? (
                  <button
                    type="button"
                    className="notice-action"
                    onClick={() => onApproveWhiteboardRequest(notification.requesterId)}
                  >
                    Allow whiteboard
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <div className="notice-item">
              <strong>Room is ready</strong>
              <p>Join updates will appear here for the meeting owner.</p>
            </div>
          )}
        </div>
      </div>

      <div className="panel-card chat-card">
        <div className="panel-header">
          <h3>Chat</h3>
        </div>
        <div ref={messagesRef} className="chat-messages">
          {messages.map((entry) => (
            <div key={entry.id} className={`chat-message ${entry.type}`}>
              <strong>{entry.sender?.fullName || "System"}</strong>
              <p>{entry.message}</p>
            </div>
          ))}
        </div>
        <form className="chat-form" onSubmit={onSend}>
          <input
            type="text"
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder="Type a message"
          />
          <button type="submit" className="primary-button">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
