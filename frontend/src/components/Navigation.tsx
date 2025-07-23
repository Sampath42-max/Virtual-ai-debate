import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import Profile from "./Profile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";

const API_URL = "https://virtual-ai-debate.onrender.com";

const Navigation = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const validateSession = async () => {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

      if (!storedUser?.email) {
        setIsLoggedIn(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: storedUser.email }),
        });

        const data = await response.json();

        if (response.ok && data.user) {
          setIsLoggedIn(true);
          // Update user info only if different
          const { name, email, profile_picture } = data.user;
          const current = localStorage.getItem("user");
          const updated = JSON.stringify({ name, email, profile_picture });
          if (current !== updated) {
            localStorage.setItem("user", updated);
          }
        } else {
          throw new Error(data?.error || "Invalid session");
        }
      } catch (err) {
        console.error("Session validation error:", err);
        localStorage.removeItem("user");
        setIsLoggedIn(false);
        toast({
          variant: "destructive",
          title: "Session Error",
          description: "Session expired. Please log in again.",
        });
        navigate("/login");
      }
    };

    validateSession();
  }, [navigate, toast]);

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`;

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gray-900/80 backdrop-blur-md z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="text-2xl font-bold text-white">
            DebateAI
          </NavLink>

          <div className="hidden md:flex gap-4">
            <NavLink to="/" className={navLinkStyle}>Home</NavLink>
            {isLoggedIn ? (
              <NavLink to="/topics" className={navLinkStyle}>Debate</NavLink>
            ) : (
              <>
                <NavLink to="/login" className={navLinkStyle}>Login</NavLink>
                <NavLink to="/signup" className={navLinkStyle}>Signup</NavLink>
              </>
            )}
          </div>
        </div>

        {isLoggedIn && (
          <div className="flex items-center">
            <Profile />
          </div>
        )}

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="md:hidden text-white">
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent className="bg-gray-800 text-white border-gray-700">
            <div className="flex flex-col gap-4 mt-4">
              <NavLink to="/" className={navLinkStyle}>Home</NavLink>
              {isLoggedIn ? (
                <NavLink to="/topics" className={navLinkStyle}>Debate</NavLink>
              ) : (
                <>
                  <NavLink to="/login" className={navLinkStyle}>Login</NavLink>
                  <NavLink to="/signup" className={navLinkStyle}>Signup</NavLink>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};

export default Navigation;
