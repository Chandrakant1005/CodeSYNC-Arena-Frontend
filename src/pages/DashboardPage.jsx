import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MeetingCard from "../components/MeetingCard";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [form, setForm] = useState({ title: "", identifier: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    api
      .get("/meetings", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((response) => setMeetings(response.data.meetings))
      .catch(() => setMeetings([]));
  }, [token]);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreateMeeting(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await api.post(
        "/meetings",
        { title: form.title },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMeetings((current) => [response.data.meeting, ...current]);
      setForm((current) => ({ ...current, title: "" }));
      navigate(`/meeting/${response.data.meeting.roomSlug}`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to create meeting.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinMeeting(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await api.post(
        "/meetings/join",
        { identifier: form.identifier },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/meeting/${response.data.meeting.roomSlug}`);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to join meeting.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="dashboard">
        <section className="dashboard-header">
          <div>
            <p className="eyebrow">CodeSYNC Arena</p>
            <h1>Welcome, {user?.fullName}</h1>
            <p className="subtle-text">
              Create a new meeting, or join instantly with a meeting ID or direct room URL.
            </p>
          </div>
          <div className="profile-chip">
            <span>{user?.fullName?.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user?.fullName}</strong>
              <p>{user?.email}</p>
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="panel-card feature-card">
            <p className="eyebrow">Create new meeting</p>
            <h2>Start a polished room in seconds</h2>
            <form className="stack-form" onSubmit={handleCreateMeeting}>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Weekly team sync"
                required
              />
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? "Creating..." : "Create meeting"}
              </button>
            </form>
          </div>

          <div className="panel-card join-card">
            <p className="eyebrow">Join by ID or URL</p>
            <h2>Enter meeting details</h2>
            <form className="stack-form" onSubmit={handleJoinMeeting}>
              <input
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                placeholder="Meeting ID or https://..."
                required
              />
              <button type="submit" className="secondary-button" disabled={busy}>
                {busy ? "Joining..." : "Join meeting"}
              </button>
            </form>
          </div>
        </section>

        {message ? <div className="inline-message">{message}</div> : null}

        <section className="meeting-list-section">
          <div className="panel-header">
            <h2>Your meetings</h2>
            <span>{meetings.length} rooms</span>
          </div>
          <div className="meeting-list">
            {meetings.length ? (
              meetings.map((meeting) => (
                <MeetingCard
                  key={meeting.meetingId}
                  meeting={meeting}
                  onOpen={(selected) => navigate(`/meeting/${selected.roomSlug}`)}
                />
              ))
            ) : (
              <div className="panel-card empty-card">
                <h3>No meetings yet</h3>
                <p>Create your first room to start collaborating.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
