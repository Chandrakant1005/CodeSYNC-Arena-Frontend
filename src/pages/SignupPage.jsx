import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import AuthForm from "../components/AuthForm";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [values, setValues] = useState({ fullName: "", email: "", password: "" });
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
      const response = await api.post("/auth/signup", values);
      setAuth(response.data);
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Signup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Join CodeSYNC Arena in a clean light workspace"
      subtitle="Create your account to host rooms, share URLs, and receive live prompts when members join or leave."
      accentLabel="React + Node + MySQL"
      switchText="Already have an account?"
      switchLink="/login"
      switchLabel="Log in"
    >
      <h2>Create account</h2>
      <AuthForm
        fields={[
          { name: "fullName", label: "Full name", type: "text", placeholder: "Your name" },
          { name: "email", label: "Email", type: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", placeholder: "Minimum 6 characters" }
        ]}
        values={values}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel="Create account"
        error={error}
        busy={busy}
      />
    </AuthLayout>
  );
}
