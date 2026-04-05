import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("meeting_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        localStorage.removeItem("meeting_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const value = {
    user,
    token,
    loading,
    setAuth: ({ token: nextToken, user: nextUser }) => {
      localStorage.setItem("meeting_token", nextToken);
      setToken(nextToken);
      setUser(nextUser);
    },
    logout: async () => {
      try {
        await api.post("/auth/logout");
      } catch (_error) {
        // Logout should still clear local state if the server is unavailable.
      }

      localStorage.removeItem("meeting_token");
      setToken(null);
      setUser(null);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
