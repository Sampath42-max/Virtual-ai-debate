import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/services/api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await login(email, password);
      localStorage.setItem("user", JSON.stringify({
        name: data.user.name,
        email: data.user.email,
        profile_picture: data.user.profile_picture
      }));
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      navigate("/topics");
    } catch (err: any) {
      console.error("Login error:", err);
      toast({
        variant: "destructive",
        title: "Login Error",
        description: err.error || "Invalid email or password",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md p-8 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-850 text-white border-zinc-800 focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors">
            Login
          </Button>
        </form>
        <p className="text-zinc-400 text-center mt-4">
          Don't have an account?{" "}
          <a href="/signup" className="text-indigo-400 hover:text-indigo-300 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;
