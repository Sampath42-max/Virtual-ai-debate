import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/services/api";
import { ToastProvider } from "@/components/ui/toast";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Password Mismatch",
        description: "Passwords do not match.",
      });
      return;
    }

    try {
      const data = await signup(name, email, password, confirmPassword);
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.data.user));
        localStorage.setItem("token", data.data.token);
        toast({
          title: "Signup Successful",
          description: "Account created! Redirecting to topics...",
        });
        navigate("/topics");
      } else {
        toast({
          variant: "destructive",
          title: data.error || "Signup Failed",
          description: data.message || "Something went wrong. Please try again.",
        });
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        variant: "destructive",
        title: "Server Error",
        description: error.message || "Could not connect to the server. Try again later.",
      });
    }
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Sign Up</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-gray-300">Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-gray-700 text-white border-gray-600"
                required
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-700 text-white border-gray-600"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-700 text-white border-gray-600"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-gray-700 text-white border-gray-600"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
              Sign Up
            </Button>
          </form>
          <p className="text-gray-400 text-center mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-purple-400 hover:underline">
              Log in
            </a>
          </p>
        </div>
      </div>
    </ToastProvider>
  );
};

export default Signup;
