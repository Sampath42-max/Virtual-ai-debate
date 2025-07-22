
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to home page since we're handling routing in App.tsx
    navigate("/", { replace: true });
  }, [navigate]);

  return null;
};

export default Index;
