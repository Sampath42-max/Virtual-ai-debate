import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Navigation from "./components/Navigation";
import HomePage from "./components/HomePage";
import Login from "./components/Login";
import Signup from "./components/Signup";
import TopicSelection from "./components/TopicSelection";
import LiveDebate from "./components/LiveDebate";
import FeedbackPage from "./components/FeedbackPage";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import { useToast } from "@/components/ui/use-toast";
import { getProfile } from "@/services/api";

declare const __API_BASE_URL__: string;

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateSession = async () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.email) {
        try {
          const result = await getProfile(); // Use api.ts getProfile function
          if (!result?.success || !result?.data?.user) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            toast({
              variant: "destructive",
              title: "Session Expired",
              description: "Please log in again.",
            });
            navigate("/login");
          }
        } catch (err: any) {
          console.error("Session validation error:", err);
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          toast({
            variant: "destructive",
            title: err.error || "Session Error",
            description: err.message || "Failed to validate session. Please log in again.",
          });
          navigate("/login");
        }
      }
      setLoading(false);
    };

    validateSession();
  }, [navigate, toast]);

  if (loading) {
    return <div className="text-white p-10 text-center">Validating session...</div>;
  }

  const hideNavigation = ["/login", "/signup"].includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {!hideNavigation && <Navigation />}
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

const App = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;
