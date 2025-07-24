import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, User, Bot, Clock, X } from "lucide-react";

interface DebateMessage {
  speaker: "user" | "ai";
  message: string;
  timestamp: Date;
}

interface DebateState {
  topic: string;
  duration: number;
  stance: string;
  level: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://virtual-ai-debate.onrender.com";

const LiveDebate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const debateState = location.state as DebateState | null;

  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(
    debateState?.duration ? debateState.duration * 60 : 300
  );
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [aiAudioUrl, setAiAudioUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    console.log("Initializing speech recognition");
    if (!("webkitSpeechRecognition" in window)) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or type your input below.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.intermResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log("Speech recognition onresult triggered");
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      setCurrentTranscript(interimTranscript);

      if (finalTranscript) {
        console.log("Final transcript:", finalTranscript);
        const newMessage: DebateMessage = {
          speaker: "user",
          message: finalTranscript.trim(),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
        setCurrentTranscript("");
        generateAIResponse(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      let errorMessage = "Speech recognition failed.";
      if (event.error === "no-speech") {
        errorMessage = "No speech detected. Please try speaking again.";
      } else if (event.error === "audio-capture") {
        errorMessage = "Microphone access denied. Please allow microphone permissions.";
      } else if (event.error === "network") {
        errorMessage = "Network issue with speech recognition. Please check your connection.";
      }
      setError(errorMessage);
      setIsListening(false);
      setIsUserSpeaking(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      setIsListening(false);
      setIsUserSpeaking(false);
    };

    recognitionRef.current = recognition;

    return () => {
      console.log("Cleaning up speech recognition");
      recognition.stop();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    console.log("Timer useEffect running");
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          endDebate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Play AI audio immediately after message is added
  useEffect(() => {
    if (aiAudioUrl && messages.some((msg) => msg.speaker === "ai")) {
      console.log("Playing AI audio:", aiAudioUrl);
      const audio = new Audio(aiAudioUrl);
      audio.play().catch((err) => {
        console.error("Audio playback error:", err);
        if (err.message.includes("404")) {
          setError("Audio file not found on server. The response is available in text.");
        } else {
          setError("Failed to play AI response audio. The response is available in text.");
        }
      });
      setAiAudioUrl(null);
    }
  }, [messages, aiAudioUrl]);

  const generateAIResponse = async (userMessage: string) => {
    console.log("Generating AI response for message:", userMessage, "with level:", debateState?.level || "Intermediate");
    if (!debateState) {
      setError("Debate configuration is missing. Please select a topic.");
      setIsAISpeaking(false);
      setIsLoadingResponse(false);
      return;
    }

    setIsAISpeaking(true);
    setIsLoadingResponse(true);
    setError(null);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => {
        console.log("API request timed out");
        controller.abort();
      }, 20000);

      const response = await fetch(`${API_BASE_URL}/api/debate/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          topic: debateState.topic,
          stance: debateState.stance,
          level: debateState.level || "Intermediate",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("API response received:", response.status);

      if (response.status === 404) {
        setError("API endpoint not found. Please ensure the backend server is running correctly.");
        return;
      }

      const data = await response.json();
      if (response.ok && data.message) {
        const aiMessage: DebateMessage = {
          speaker: "ai",
          message: data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        console.log("AI message added:", data.message);
        if (data.audio_url) {
          setAiAudioUrl(data.audio_url);
        } else {
          setError("No audio available for this response.");
        }
      } else {
        setError(data.error || "Failed to get AI response from server.");
      }
    } catch (error: any) {
      console.error("API error:", error);
      let errorMessage = `Failed to connect to the server. Please ensure the backend is running on ${API_BASE_URL}.`;
      if (error.name === "AbortError") {
        errorMessage = "API request timed out after 20 seconds. Please try again.";
      } else if (error.message && error.message.includes("CORS")) {
        errorMessage = `CORS error: Backend rejected the request. Check server configuration and ensure CORS allows ${window.location.origin}.`;
      } else if (error.message && error.message.includes("NetworkError")) {
        errorMessage = "Network error: Unable to reach server. Check your connection or server status.";
      }
      setError(errorMessage);
    } finally {
      console.log("Resetting isAISpeaking and isLoadingResponse");
      setIsAISpeaking(false);
      setIsLoadingResponse(false);
      abortControllerRef.current = null;
    }
  };

  const cancelAIResponse = () => {
    console.log("Cancelling AI response");
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsAISpeaking(false);
      setIsLoadingResponse(false);
      setAiAudioUrl(null);
      setError("AI response cancelled.");
      abortControllerRef.current = null;
    }
  };

  const toggleListening = () => {
    console.log("Toggling listening:", !isListening);
    if (!recognitionRef.current) {
      setError("Speech recognition is not available. Please use the text input below.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      cancelAIResponse();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setIsUserSpeaking(true);
        setError(null);
      } catch (err) {
        console.error("Error starting speech recognition:", err);
        setError("Failed to start speech recognition. Please check microphone permissions.");
      }
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      console.log("Text input submitted:", textInput);
      const newMessage: DebateMessage = {
        speaker: "user",
        message: textInput,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      generateAIResponse(textInput);
      setTextInput("");
    }
  };

  const endDebate = async () => {
    console.log("Ending debate");
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    cancelAIResponse();

    const userMessages = messages.filter((m) => m.speaker === "user");
    const totalWords = userMessages.reduce((acc, msg) => acc + msg.message.split(" ").length, 0);
    const avgResponseTime = userMessages.length > 0 ? timeRemaining / userMessages.length : 0;

    const performanceData = {
      totalMessages: userMessages.length,
      totalWords,
      avgResponseTime,
      topic: debateState?.topic || "Unknown",
      duration: debateState?.duration || 5,
      level: debateState?.level || "Intermediate",
    };

    // Increment debates_attended
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.email) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/debate/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        });
        if (response.status === 404) {
          console.error("Debate complete endpoint not found");
          setError("Debate completion endpoint not found. Progress may not be saved.");
        }
      } catch (err) {
        console.error("Error incrementing debate count:", err);
        setError("Failed to update debate count. Check server connection.");
      }
    }

    navigate("/feedback", { state: performanceData });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!debateState) {
    console.log("No debate state, redirecting to /topics");
    navigate("/topics");
    return null;
  }

  return (
    <div className="min-h-screen pt-16 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">Live Debate</span>
          </h1>
          <p className="text-gray-300 mb-2">Topic: {debateState.topic}</p>
          <p className="text-gray-300 mb-2">Your Position: {debateState.stance}</p>
          <p className="text-gray-300 mb-4">Level: {debateState.level || "Intermediate"}</p>
          <div className="flex items-center justify-center gap-2 text-lg font-semibold">
            <Clock size={20} className="text-purple-400" />
            <span className={timeRemaining < 60 ? "text-red-400" : "text-white"}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-400 text-center mb-4">
            {error}
          </div>
        )}

        {/* Loading Indicator */}
        {isLoadingResponse && (
          <div className="text-purple-400 text-center mb-4">
            Waiting for AI response...
            <button
              onClick={cancelAIResponse}
              className="ml-2 px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          {/* Left Side - User Profile */}
          <div className="glass-card rounded-xl p-6 h-fit">
            <div className="text-center">
              <div className={`relative inline-block ${isUserSpeaking ? "animate-pulse-ring" : ""}`}>
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center mx-auto mb-4">
                  <User size={32} className="text-white" />
                </div>
                {isUserSpeaking && (
                  <div className="absolute inset-0 rounded-full bg-blue-400/30 animate-pulse-ring"></div>
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2">You</h3>
              <p className="text-gray-400 text-sm">Position: {debateState.stance}</p>

              <div className="mt-6">
                <button
                  onClick={toggleListening}
                  disabled={!recognitionRef.current}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                    isListening
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-green-500 hover:bg-green-600 text-white"
                  } ${!recognitionRef.current ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  {isListening ? "Stop Recording" : "Start Recording"}
                </button>
              </div>

              {/* Fallback Text Input */}
              <div className="mt-4">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your argument (fallback)"
                  className="w-full p-2 rounded-lg bg-white/10 text-white"
                />
                <button
                  onClick={handleTextSubmit}
                  className="mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg w-full"
                >
                  Submit
                </button>
              </div>

              {currentTranscript && (
                <div className="mt-4 p-3 bg-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300">Listening...</p>
                  <p className="text-white">{currentTranscript}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - AI Profile */}
          <div className="glass-card rounded-xl p-6 h-fit">
            <div className="text-center">
              <div className={`relative inline-block ${isAISpeaking ? "animate-pulse-ring" : ""}`}>
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center mx-auto mb-4">
                  <Bot size={32} className="text-white" />
                </div>
                {isAISpeaking && (
                  <div className="absolute inset-0 rounded-full bg-purple-400/30 animate-pulse-ring"></div>
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Coach</h3>
              {isAISpeaking && (
                <div className="mt-4 flex justify-center">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce-dots"></div>
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce-dots"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce-dots"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Debate Transcript */}
          <div className="glass-card rounded-xl p-6 flex flex-col">
            <h3 className="text-xl font-semibold mb-4">Debate Between You and AI</h3>

            <div className="flex-1 overflow-y-auto space-y-4 max-h-96">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.speaker === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.speaker === "user"
                        ? "bg-blue-500/20 text-blue-100"
                        : "bg-purple-500/20 text-purple-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {message.speaker === "user" ? <User size={16} /> : <Bot size={16} />}
                      <span className="text-sm font-medium">
                        {message.speaker === "user" ? "You" : "AI"}
                      </span>
                    </div>
                    <p className="text-sm">{message.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <p>Start recording or type to begin the debate!</p>
              </div>
            )}
          </div>
        </div>

        {/* End Debate Button */}
        <div className="text-center mt-8">
          <button
            onClick={endDebate}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
          >
            End Debate Early
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveDebate;
