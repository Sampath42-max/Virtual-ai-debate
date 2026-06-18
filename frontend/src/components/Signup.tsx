// Updated Signup.tsx with password validation and visibility toggle
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/services/api";
import { Eye, EyeOff } from "lucide-react";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordValid = (pwd: string) => {
    return /^[A-Za-z][A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{7,}$/.test(pwd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValid(password)) {
      toast({
        variant: "destructive",
        title: "Invalid Password",
        description:
          "Password must be 8+ characters, start with a letter, and include alphabets, numbers, and symbols.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords do not match",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const data = await signup(name, email, password, confirmPassword);
      localStorage.setItem("user", JSON.stringify({
        name: data.user.name,
        email: data.user.email,
        profile_picture: data.user.profile_picture,
      }));
      toast({
        title: "Signup Successful",
        description: "Account created! Redirecting to topics.",
      });
      navigate("/topics");
    } catch (err: any) {
      console.error("Signup error:", err);
      toast({
        variant: "destructive",
        title: "Signup Error",
        description:
          err.error || "Failed to connect to the server. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign Up</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-zinc-300">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-850 text-white border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-850 text-white border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-zinc-300">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-850 text-white border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500 pr-10"
                required
              />
              <span
                className="absolute right-3 top-2.5 text-zinc-400 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Password must be 8+ characters, start with a letter, and include alphabets, numbers, and symbols.
            </p>
          </div>
          <div>
            <Label htmlFor="confirmPassword" className="text-zinc-300">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-zinc-850 text-white border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500 pr-10"
                required
              />
              <span
                className="absolute right-3 top-2.5 text-zinc-400 cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors mt-2">
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </Button>
        </form>
        <p className="text-zinc-400 text-center mt-4">
          Already have an account?{" "}
          <a href="/login" className="text-indigo-400 hover:text-indigo-300 hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
};

export default Signup;
