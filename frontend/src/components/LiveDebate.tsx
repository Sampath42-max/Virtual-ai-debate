import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, User, Bot, Clock, X, Volume2 } from 'lucide-react';

// Constants
const API_BASE_URL = "https://virtual-ai-debate.onrender.com/api";
const ALLOWED_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const MAX_NO_SPEECH_RETRIES = 3;
const DEBATE_END_BUFFER_SECONDS = 5;

// Types
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

interface PerformanceData {
  totalMessages: number;
  totalWords: number;
  avgResponseTime: number;
  topic: string;
  duration: number;
  level: string;
}

const LiveDebate = () => {
  // Hooks
  const location = useLocation();
  const navigate = useNavigate();
  const debateState = location.state as DebateState | null;

  // State
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
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [noSpeechRetryCount, setNoSpeechRetryCount] = useState(0);
  const [isDebateEnding, setIsDebateEnding] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone permissions
  const checkMicPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" as any });
      if (permissionStatus.state === "denied") {
        setMicPermissionDenied(true);
        setError("Microphone access denied. Please enable permissions in browser settings.");
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error checking microphone permissions:", err);
      setError("Failed to check microphone permissions. Using text input as fallback.");
      return false;
    }
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      setError("Speech recognition not supported. Please use Chrome or text input.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setIsUserSpeaking(true);
      setNoSpeechRetryCount(0);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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
        const trimmedTranscript = finalTranscript.trim();
        if (trimmedTranscript.length >= 3) {
          addUserMessage(trimmedTranscript);
          setCurrentTranscript("");
          setNoSpeechRetryCount(0);
        } else {
          setError("Speech input too short. Please provide a longer argument.");
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      handleRecognitionError(event.error);
    };

    recognition.onend = () => {
      if (isListening && noSpeechRetryCount < MAX_NO_SPEECH_RETRIES) {
        return;
      }
      setIsListening(false);
      setIsUserSpeaking(false);
    };

    recognitionRef.current = recognition;

    // Initial permission check
    checkMicPermissions();

    return () => {
      recognition.stop();
    };
  }, [isListening, noSpeechRetryCount, checkMicPermissions]);

  // Timer countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= DEBATE_END_BUFFER_SECONDS) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          endDebate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-scroll and audio handling
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    // Cleanup audio on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [messages]);

  // Play AI audio when URL changes
  useEffect(() => {
    if (aiAudioUrl) {
      playAudio(aiAudioUrl);
      setAiAudioUrl(null);
    }
  }, [aiAudioUrl]);

  // Helper functions
  const addUserMessage = (message: string) => {
    const newMessage: DebateMessage = {
      speaker: "user",
      message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    generateAIResponse(message);
  };

  const handleRecognitionError = (error: string) => {
    let errorMessage = "Speech recognition error.";
    
    switch (error) {
      case "no-speech":
        if (noSpeechRetryCount < MAX_NO_SPEECH_RETRIES) {
          errorMessage = `No speech detected. Retrying... (${noSpeechRetryCount + 1}/${MAX_NO_SPEECH_RETRIES})`;
          setNoSpeechRetryCount((prev) => prev + 1);
          setTimeout(() => recognitionRef.current?.start(), 1000);
        } else {
          errorMessage = "No speech detected after multiple attempts.";
          setIsListening(false);
        }
        break;
      case "audio-capture":
        errorMessage = "Microphone access denied. Please check permissions.";
        setMicPermissionDenied(true);
        setIsListening(false);
        break;
      case "network":
        errorMessage = "Network error. Please check your connection.";
        setIsListening(false);
        break;
      default:
        errorMessage = `Error: ${error}. Please try again.`;
        setIsListening(false);
    }

    setError(errorMessage);
    setIsUserSpeaking(false);
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.play().catch((err) => {
      console.error("Audio playback error:", err);
      setError("Failed to play audio. The response is available in text.");
    });
  };

  const generateAIResponse = async (userMessage: string, retries = 2) => {
    if (!debateState || userMessage.length < 3) {
      setError("Invalid input or debate configuration.");
      return;
    }

    setIsAISpeaking(true);
    setIsLoadingResponse(true);
    setError(null);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

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

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      if (data.message) {
        const aiMessage: DebateMessage = {
          speaker: "ai",
          message: data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        if (data.audio_url) setAiAudioUrl(data.audio_url);
      }
    } catch (error: any) {
      handleAIResponseError(error, userMessage, retries);
    } finally {
      setIsAISpeaking(false);
      setIsLoadingResponse(false);
      abortControllerRef.current = null;
    }
  };

  const handleAIResponseError = (error: any, userMessage: string, retries: number) => {
    let errorMessage = "Failed to get AI response.";

    if (error.name === "AbortError") {
      errorMessage = "Request timed out.";
      if (retries > 0) {
        setTimeout(() => generateAIResponse(userMessage, retries - 1), 1000);
        return;
      }
    } else if (error.message.includes("CORS")) {
      errorMessage = "CORS error. Please check server configuration.";
    } else if (error.message.includes("NetworkError")) {
      errorMessage = "Network error. Please check your connection.";
    }

    setError(errorMessage);
  };

  const toggleListening = async () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not available.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      cancelAIResponse();
    } else {
      const hasPermission = await checkMicPermissions();
      if (!hasPermission) return;

      try {
        recognitionRef.current.start();
        setIsListening(true);
        setError(null);
      } catch (err) {
        setError("Failed to start speech recognition.");
        setMicPermissionDenied(true);
      }
    }
  };

  const cancelAIResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsAISpeaking(false);
    setIsLoadingResponse(false);
    setError("AI response cancelled.");
  };

  const handleTextSubmit = () => {
    if (textInput.trim().length >= 3) {
      addUserMessage(textInput.trim());
      setTextInput("");
    } else {
      setError("Please enter at least 3 characters.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const playLatestAudio = () => {
    const latestAIMessage = messages.filter((msg) => msg.speaker === "ai").pop();
    if (latestAIMessage && aiAudioUrl) {
      playAudio(aiAudioUrl);
    }
  };

  const endDebate = async () => {
    if (isDebateEnding) return;
    setIsDebateEnding(true);

    if (recognitionRef.current) recognitionRef.current.stop();
    cancelAIResponse();
    if (timerRef.current) clearInterval(timerRef.current);

    const userMessages = messages.filter((m) => m.speaker === "user");
    const performanceData: PerformanceData = {
      totalMessages: userMessages.length,
      totalWords: userMessages.reduce((acc, msg) => acc + msg.message.split(" ").length, 0),
      avgResponseTime: userMessages.length > 0 ? timeRemaining / userMessages.length : 0,
      topic: debateState?.topic || "Unknown",
      duration: debateState?.duration || 5,
      level: debateState?.level || "Intermediate",
    };

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.email) {
        await fetch(`${API_BASE_URL}/api/debate/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        });
      }
    } catch (err) {
      console.error("Error saving debate completion:", err);
    }

    navigate("/feedback", { state: performanceData });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!debateState) {
    navigate("/topics");
    return null;
  }

  return (
    <div className="min-h-screen pt-16 flex flex-col bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Live Debate
          </h1>
          <div className="space-y-1">
            <p className="text-gray-300">Topic: {debateState.topic}</p>
            <p className="text-gray-300">Your Position: {debateState.stance}</p>
            <p className="text-gray-300">Level: {debateState.level}</p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-lg font-semibold">
            <Clock size={20} className="text-purple-400" />
            <span className={timeRemaining < 60 ? "text-red-400" : "text-white"}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        {error && (
          <div className="bg-red-900/50 border border-red-400 rounded-lg p-3 text-center mb-4">
            <p>{error}</p>
            {micPermissionDenied && (
              <a
                href="https://support.google.com/chrome/answer/2693767"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 underline mt-1 inline-block"
              >
                Enable Microphone Guide
              </a>
            )}
          </div>
        )}

        {isLoadingResponse && (
          <div className="bg-purple-900/50 border border-purple-400 rounded-lg p-3 text-center mb-4 flex items-center justify-center gap-2">
            <span>Waiting for AI response...</span>
            <button
              onClick={cancelAIResponse}
              className="p-1 bg-red-500 hover:bg-red-600 rounded-full"
              aria-label="Cancel response"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* User Panel */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 h-fit">
            <div className="text-center">
              <div className={`relative inline-block ${isUserSpeaking ? "animate-pulse-ring" : ""}`}>
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center mx-auto mb-4">
                  <User size={32} className="text-white" />
                </div>
                {isUserSpeaking && (
                  <div className="absolute inset-0 rounded-full bg-blue-400/30 animate-pulse-ring-delayed"></div>
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2">You</h3>
              <p className="text-gray-400 text-sm mb-4">Position: {debateState.stance}</p>

              <button
                onClick={toggleListening}
                disabled={micPermissionDenied}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 mb-4 ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-500 hover:bg-green-600"
                } ${micPermissionDenied ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                {isListening ? "Stop Recording" : "Start Recording"}
              </button>

              <div className="mt-4">
                <p className="text-gray-400 text-sm mb-2">
                  {micPermissionDenied ? "Microphone disabled. Use text input:" : "Or type your argument:"}
                </p>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your argument..."
                  className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                />
                <button
                  onClick={handleTextSubmit}
                  className="mt-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                  Submit
                </button>
              </div>

              {currentTranscript && (
                <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-800">
                  <p className="text-sm text-blue-300 flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Listening...
                  </p>
                  <p className="text-white mt-1">{currentTranscript}</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Panel */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 h-fit">
            <div className="text-center">
              <div className={`relative inline-block ${isAISpeaking ? "animate-pulse-ring" : ""}`}>
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
                  <Bot size={32} className="text-white" />
                </div>
                {isAISpeaking && (
                  <div className="absolute inset-0 rounded-full bg-purple-400/30 animate-pulse-ring-delayed"></div>
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Coach</h3>

              {isAISpeaking && (
                <div className="flex justify-center my-4">
                  <div className="flex gap-1.5">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {messages.some((msg) => msg.speaker === "ai") && (
                <button
                  onClick={playLatestAudio}
                  disabled={!aiAudioUrl}
                  className={`mt-4 w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition ${
                    aiAudioUrl
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-gray-600 cursor-not-allowed"
                  }`}
                >
                  <Volume2 size={18} />
                  Replay AI Response
                </button>
              )}
            </div>
          </div>

          {/* Debate Transcript */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 flex flex-col">
            <h3 className="text-xl font-semibold mb-4">Debate Transcript</h3>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[400px]">
              {messages.length > 0 ? (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.speaker === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.speaker === "user"
                          ? "bg-blue-600/20 border border-blue-700/50"
                          : "bg-purple-600/20 border border-purple-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {message.speaker === "user" ? (
                          <User size={16} className="text-blue-300" />
                        ) : (
                          <Bot size={16} className="text-purple-300" />
                        )}
                        <span className="text-sm font-medium">
                          {message.speaker === "user" ? "You" : "AI"}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <p>Start speaking or typing to begin the debate</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* End Debate Button */}
        <div className="text-center mt-8">
          <button
            onClick={endDebate}
            disabled={isDebateEnding}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDebateEnding ? "Ending Debate..." : "End Debate Early"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveDebate;
