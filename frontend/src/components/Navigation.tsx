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

const API_URL = '/api'; // Use the same proxy as api.js

const Navigation = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
          if (response.ok && data.user) {
            setIsLoggedIn(true);
            localStorage.setItem("user", JSON.stringify({
              name: data.user.name,
              email: data.user.email,
              profile_picture: data.user.profile_picture
            }));
          } else {
            localStorage.removeItem("user");
            setIsLoggedIn(false);
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
          setIsLoggedIn(false);
          toast({
            variant: "destructive",
            title: "Session Error",
            description: "Failed to validate session. Please log in again.",
          });
          navigate("/login");
        }
      } else {
        setIsLoggedIn(false);
      }
    };

    validateSession();
  }, [navigate, toast]);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gray-900/80 backdrop-blur-md z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <NavLink to="/" className="text-2xl font-bold text-white">
            DebateAI
          </NavLink>
          <div className="hidden md:flex gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
              }
            >
              Home
            </NavLink>
            {isLoggedIn ? (
              <NavLink
                to="/topics"
                className={({ isActive }) =>
                  `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
                }
              >
                Debate
              </NavLink>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
                  }
                >
                  Login
                </NavLink>
                <NavLink
                  to="/signup"
                  className={({ isActive }) =>
                    `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
                  }
                >
                  Signup
                </NavLink>
              </>
            )}
          </div>
        </div>

        {isLoggedIn && (
          <div className="flex items-center">
            <Profile />
          </div>
        )}

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="md:hidden text-white">
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent className="bg-gray-800 text-white border-gray-700">
            <div className="flex flex-col gap-4 mt-4">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
                }
              >
                Home
              </NavLink>
              {isLoggedIn ? (
                <NavLink
                  to="/topics"
                  className={({ isActive }) =>
                    `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
                  }
                >
                  Debate
                </NavLink>
              ) : (
                <>
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
                    }
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/signup"
                    className={({ isActive }) =>
                      `text-gray-300 hover:text-white transition-colors ${isActive ? "text-purple-400" : ""}`
                    }
                  >
                    Signup
                  </NavLink>
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
