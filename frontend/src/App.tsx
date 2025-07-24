// Updated App.tsx
import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import Navigation from "./components/Navigation";
import HomePage from "./components/HomePage";
import Login from "./components/Login";
import Signup from "./components/Signup";
import TopicSelection from "./components/TopicSelection";
import LiveDebate from "./components/LiveDebate";
import FeedbackPage from "./components/FeedbackPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useToast } from "@/components/ui/use-toast";
import NotFound from "./pages/NotFound";

const API_URL = import.meta.env.VITE_API_BASE_URL;

const AppContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const validateSession = async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.email) {
        try {
          const response = await fetch(`${API_URL}/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
          });
          const data = await response.json();
          if (!response.ok || !data.user) {
            localStorage.removeItem("user");
            toast({
              variant: "destructive",
              title: "Session Expired",
              description: "Please log in again.",
            });
            navigate("/login");
          }
        } catch (err) {
          console.error("Session validation error:", err);
          localStorage.removeItem("user");
          toast({
            variant: "destructive",
            title: "Session Error",
            description: "Failed to validate session. Please log in again.",
          });
          navigate("/login");
        }
      }
    };

    validateSession();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/topics"
          element={
            <ProtectedRoute>
              <TopicSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/debate"
          element={
            <ProtectedRoute>
              <LiveDebate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedback"
          element={
            <ProtectedRoute>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
