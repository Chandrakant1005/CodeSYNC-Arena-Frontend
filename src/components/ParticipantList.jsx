export default function ParticipantList({ participants, ownerId }) {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>Participants</h3>
        <span>{participants.length}</span>
      </div>
      <div className="participant-list">
        {participants.map((participant) => (
          <div key={participant.socketId || participant.user.id} className="participant-row">
            <div className="avatar-circle">
              {participant.user.fullName
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <strong>{participant.user.fullName}</strong>
              <p>{participant.user.id === ownerId ? "Owner" : "Guest"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
