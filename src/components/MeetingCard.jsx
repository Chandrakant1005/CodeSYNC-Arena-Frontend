export default function MeetingCard({ meeting, onOpen }) {
  return (
    <button type="button" className="meeting-card" onClick={() => onOpen(meeting)}>
      <div>
        <p className="eyebrow">Meeting ID</p>
        <h3>{meeting.meetingId}</h3>
      </div>
      <div className="meeting-card-footer">
        <div>
          <p>{meeting.title}</p>
          <span>{meeting.owner.fullName}</span>
        </div>
        <span className={`status-badge ${meeting.status}`}>{meeting.status}</span>
      </div>
    </button>
  );
}
