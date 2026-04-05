import {
  FiCalendar,
  FiHome,
  FiLogOut,
  FiMessageSquare,
  FiSettings,
  FiUsers,
  FiVideo
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import brandLogo from "../assets/logo.png";

const items = [
  { icon: FiHome, label: "Home", path: "/dashboard" },
  { icon: FiVideo, label: "Meetings", path: "/dashboard" },
  { icon: FiUsers, label: "Team", path: "/dashboard" },
  { icon: FiCalendar, label: "Schedule", path: "/dashboard" },
  { icon: FiMessageSquare, label: "Messages", path: "/dashboard" },
  { icon: FiSettings, label: "Settings", path: "/dashboard" }
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={brandLogo} alt="CodeSYNC Arena" className="sidebar-brand-image" />
      </div>
      <nav className="sidebar-nav">
        {items.map(({ icon: Icon, label, path }) => (
          <button
            key={label}
            type="button"
            className={`sidebar-item ${pathname === path ? "active" : ""}`}
            onClick={() => navigate(path)}
            title={label}
          >
            <Icon />
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="sidebar-item logout"
        title="Logout"
        onClick={logout}
      >
        <FiLogOut />
      </button>
    </aside>
  );
}
