import {
  FiCamera,
  FiEdit3,
  FiMic,
  FiMicOff,
  FiMonitor,
  FiPhoneOff,
  FiVideo,
  FiVideoOff
} from "react-icons/fi";
import { useEffect, useRef } from "react";
import WhiteboardPanel from "./WhiteboardPanel";

function StreamTile({
  stream,
  label,
  muted = false,
  isLocal = false,
  className = "",
  active = false,
  onClick
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <button
      type="button"
      className={`stream-tile ${className} ${active ? "active" : ""}`.trim()}
      onClick={onClick}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="stream-video"
        />
      ) : (
        <div className="stream-placeholder">
          <span>{label?.slice(0, 2)?.toUpperCase() || "CS"}</span>
        </div>
      )}
      <div className="stream-label">
        <strong>{label}</strong>
        <span>{isLocal ? "You" : "Participant"}</span>
      </div>
    </button>
  );
}

export default function VideoPanel({
  currentUser,
  meeting,
  onLeave,
  localStream,
  remoteStreams,
  participantTiles,
  audioEnabled,
  videoEnabled,
  whiteboardVisible,
  whiteboardPending,
  isOwner,
  selectedMainStream,
  selectedMainId,
  onSelectParticipant,
  onToggleAudio,
  onToggleVideo,
  onShareScreen,
  onWhiteboardClick,
  whiteboardProps
}) {
  const mainLabel = selectedMainStream?.label || currentUser?.fullName || "You";
  const showingLocal = selectedMainStream?.type !== "remote";

  return (
    <div className="video-panel">
      <div className="video-topbar">
        <div>
          <p className="eyebrow">{whiteboardVisible ? "Shared Whiteboard" : "Live Preview"}</p>
          <h2>{meeting?.title || "CodeSYNC Arena room"}</h2>
        </div>
        <span className="recording-pill">
          {whiteboardVisible
            ? "Whiteboard live"
            : remoteStreams.length
              ? `${remoteStreams.length + 1} live`
              : "Waiting for participants"}
        </span>
      </div>

      <div className="main-video">
        {whiteboardVisible ? (
          <WhiteboardPanel embedded {...whiteboardProps} />
        ) : (
          <>
            <StreamTile
              stream={selectedMainStream?.stream || localStream}
              label={mainLabel}
              muted={showingLocal}
              isLocal={showingLocal}
              className="stream-tile-main"
            />

            <div className="person-badge">
              {mainLabel?.slice(0, 2)?.toUpperCase() || "ME"}
            </div>

          </>
        )}
      </div>

      <div className="meeting-controls">
        <button
          type="button"
          className={`control-button ${audioEnabled ? "" : "muted"}`.trim()}
          title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
          onClick={onToggleAudio}
        >
          {audioEnabled ? <FiMic /> : <FiMicOff />}
        </button>
        <button
          type="button"
          className={`control-button ${videoEnabled ? "" : "muted"}`.trim()}
          title={videoEnabled ? "Turn camera off" : "Turn camera on"}
          onClick={onToggleVideo}
        >
          {videoEnabled ? <FiVideo /> : <FiVideoOff />}
        </button>
        <button type="button" className="control-button danger" title="Leave meeting" onClick={onLeave}>
          <FiPhoneOff />
        </button>
        <button
          type="button"
          className={`control-button ${whiteboardVisible ? "active-tool" : ""} ${whiteboardPending ? "muted" : ""}`.trim()}
          title={
            isOwner
              ? whiteboardVisible
                ? "Hide whiteboard"
                : "Show whiteboard"
              : whiteboardVisible
                ? "Whiteboard is live"
                : whiteboardPending
                  ? "Request sent to owner"
                  : "Request whiteboard access"
          }
          onClick={onWhiteboardClick}
        >
          <FiEdit3 />
        </button>
        <button type="button" className="control-button" title="Share screen" onClick={onShareScreen}>
          <FiMonitor />
        </button>
      </div>

      <div className="participant-strip">
        <div className="participant-strip-header">
          <p className="eyebrow">Participants</p>
          <span>{participantTiles.length} connected</span>
        </div>
        <div className="participant-strip-grid">
          {participantTiles.map((participant) => (
            <StreamTile
              key={participant.id}
              stream={participant.stream}
              label={participant.label}
              muted={participant.isLocal}
              isLocal={participant.isLocal}
              className="stream-tile-mini"
              active={selectedMainId === participant.id}
              onClick={() => onSelectParticipant(participant.id)}
            />
          ))}
          {!participantTiles.length ? (
            <div className="participant-empty-card">
              <strong>No other participants yet</strong>
              <span>Participant video feeds will appear here once someone joins.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
