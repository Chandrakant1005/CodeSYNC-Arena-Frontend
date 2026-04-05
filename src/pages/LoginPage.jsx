import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import AuthForm from "../components/AuthForm";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await api.post("/auth/login", values);
      setAuth(response.data);
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back to CodeSYNC Arena"
      subtitle="Sign in to create rooms, invite participants, and manage live sessions in one place."
      accentLabel="Light meeting workspace"
      switchText="New here?"
      switchLink="/signup"
      switchLabel="Create an account"
    >
      <h2>Login</h2>
      <AuthForm
        fields={[
          { name: "email", label: "Email", type: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", placeholder: "••••••••" }
        ]}
        values={values}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel="Login"
        error={error}
        busy={busy}
      />
    </AuthLayout>
  );
}
