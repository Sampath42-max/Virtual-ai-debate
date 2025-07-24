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

const Profile = () => {
  const [user, setUser] = useState<{
    name: string;
    email: string;
    debates_attended: number;
    profile_picture: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (!storedUser.email) {
        setError("No user logged in");
        navigate("/login");
        return;
      }

      try {
        const response = await fetch("http://localhost:5000/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: storedUser.email }),
        });

        const data = await response.json();
        if (response.ok && data.user) {
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify({
            name: data.user.name,
            email: data.user.email,
            profile_picture: data.user.profile_picture
          }));
        } else {
          setError(data.error || "Failed to fetch profile");
          localStorage.removeItem("user");
          toast({
            variant: "destructive",
            title: "Profile Error",
            description: data.error || "Failed to fetch profile",
          });
          navigate("/login");
        }
      } catch (err: any) {
        console.error("Profile fetch error:", err);
        let errorMessage = "Failed to connect to the server. Please ensure the backend is running.";
        if (err.message.includes("CORS")) {
          errorMessage = "CORS error: Backend rejected the request.";
        } else if (err.message.includes("NetworkError")) {
          errorMessage = "Network error: Unable to reach server.";
        }
        setError(errorMessage);
        localStorage.removeItem("user");
        toast({
          variant: "destructive",
          title: "Profile Error",
          description: errorMessage,
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

  if (!user || error) {
    return null;
  }

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
                e.currentTarget.style.display = 'none';
                const nextSibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (nextSibling) {
                  nextSibling.style.display = 'block';
                }
              }}
            />
          ) : null}
          <User
            size={32}
            className={`text-purple-400 ${user.profile_picture ? 'hidden' : 'block'}`}
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
                  e.currentTarget.style.display = 'none';
                  const nextSibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (nextSibling) {
                    nextSibling.style.display = 'block';
                  }
                }}
              />
            ) : null}
            <User
              size={40}
              className={`text-purple-400 ${user.profile_picture ? 'hidden' : 'block'}`}
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
