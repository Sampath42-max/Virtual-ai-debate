import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_URL = "https://virtual-ai-debate.onrender.com/api";

const Profile = () => {
  const [user, setUser] = useState<{
    name: string;
    email: string;
    debates_attended: number;
    profile_picture?: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

      if (!storedUser.email) {
        setError("User not logged in");
        navigate("/login");
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
          const { name, email, profile_picture, debates_attended } = data.user;
          const formattedUser = { name, email, profile_picture, debates_attended };

          setUser(formattedUser);
          localStorage.setItem("user", JSON.stringify(formattedUser));
        } else {
          throw new Error(data.error || "Failed to fetch profile");
        }
      } catch (err: any) {
        const msg =
          err?.message?.includes("CORS")
            ? "CORS error: Backend rejected the request."
            : err?.message?.includes("NetworkError")
            ? "Network error: Unable to reach server."
            : err?.message || "An unknown error occurred.";

        setError(msg);
        localStorage.removeItem("user");

        toast({
          variant: "destructive",
          title: "Profile Error",
          description: msg,
        });

        navigate("/login");
      }
    };

    fetchProfile();
  }, [navigate, toast]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    });
    navigate("/login");
  };

  if (!user || error) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 text-white">
          {user.profile_picture ? (
            <img
              src={user.profile_picture}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "block";
              }}
            />
          ) : null}
          <User
            size={32}
            className={`text-purple-400 ${user.profile_picture ? "hidden" : "block"}`}
          />
          <span>{user.name}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 bg-gray-800 text-white border-gray-700">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {user.profile_picture ? (
              <img
                src={user.profile_picture}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "block";
                }}
              />
            ) : null}
            <User
              size={40}
              className={`text-purple-400 ${user.profile_picture ? "hidden" : "block"}`}
            />
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuItem className="text-gray-300">
          Debates Attended: {user.debates_attended}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-gray-700" />

        <DropdownMenuItem onClick={handleLogout} className="text-red-400">
          <LogOut size={16} className="mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default Profile;
