import { Link } from "react-router-dom";
import brandLogo from "../assets/logo.png";

export default function AuthLayout({
  title,
  subtitle,
  accentLabel,
  switchText,
  switchLink,
  switchLabel,
  children
}) {
  return (
    <div className="page-shell auth-shell">
      <section className="auth-hero">
        <div className="brand-pill">{accentLabel}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="auth-preview-card">
          <div className="preview-grid">
            <div className="preview-video large" />
            <div className="preview-video small top" />
            <div className="preview-video small middle" />
            <div className="preview-video small bottom" />
          </div>
          <div className="preview-toolbar">
            <span />
            <span />
            <span className="danger" />
          </div>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-card-brand">
          <span className="auth-card-brand-mark">
            <img src={brandLogo} alt="CodeSYNC Arena" className="auth-card-brand-image" />
          </span>
          <div>
            <strong>CodeSYNC Arena</strong>
            <p>Secure meeting workspace</p>
          </div>
        </div>
        {children}
        <p className="auth-switch">
          {switchText} <Link to={switchLink}>{switchLabel}</Link>
        </p>
      </section>
    </div>
  );
}
