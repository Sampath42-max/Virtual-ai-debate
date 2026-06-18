import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, User, Bot, Clock, X, Send, Volume2 } from "lucide-react";
import { API_URL } from "@/services/api";

interface DebateMessage {
  speaker: "user" | "ai";
  message: string;
  timestamp: Date;
  audioUrl?: string; // Cache URL to replay audio
}

interface DebateState {
  topic: string;
  duration: number;
  stance: string;
  level: string;
}

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const transcriptAccumulatorRef = useRef("");
  const currentTranscriptRef = useRef("");
  const hasSubmittedRef = useRef(false);

  // Initialize speech recognition
  useEffect(() => {
    console.log("Initializing speech recognition");
    if (!("webkitSpeechRecognition" in window)) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or type your input below.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true; // Use continuous to avoid quick silent timeouts
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("Speech recognition started");
      transcriptAccumulatorRef.current = "";
      currentTranscriptRef.current = "";
      hasSubmittedRef.current = false;
      setCurrentTranscript("");
      setError(null);
    };

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

      if (finalTranscript) {
        transcriptAccumulatorRef.current += finalTranscript;
        // Stop recognition upon receiving the first final transcript to prevent hearing AI response
        recognition.stop();
      }

      const fullText = (transcriptAccumulatorRef.current + interimTranscript).trim();
      currentTranscriptRef.current = fullText;
      setCurrentTranscript(fullText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      let errorMessage = "Speech recognition failed.";
      if (event.error === "no-speech") {
        errorMessage = "No speech detected. Please try speaking again.";
      } else if (event.error === "audio-capture") {
        errorMessage = "Microphone access failed. Please ensure your microphone is plugged in.";
      } else if (event.error === "not-allowed") {
        errorMessage = "Microphone permission denied or blocked. Please allow microphone access in your browser settings.";
      } else if (event.error === "network") {
        errorMessage = "Network issue with speech recognition. Chrome's Web Speech API requires an active internet connection to contact Google's speech recognition servers. Please check your internet connection, verify you are using Chrome/Edge on http://localhost:5173 (not an IP address), and ensure no VPN or proxy is blocking 'google.com/speech-api'.";
      }
      setError(errorMessage);
      setIsListening(false);
      setIsUserSpeaking(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      setIsListening(false);
      setIsUserSpeaking(false);

      // Auto-submit whatever we heard
      const textToSend = currentTranscriptRef.current.trim();
      if (textToSend && !hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        const newMessage: DebateMessage = {
          speaker: "user",
          message: textToSend,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
        setCurrentTranscript("");
        currentTranscriptRef.current = "";
        generateAIResponse(textToSend);
      }
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

  // Initialize audio element and handle cleanup
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const unlockAudio = () => {
    if (audioRef.current) {
      // Play a split second of silence to unlock browser autoplay context
      audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";
      audioRef.current.play().catch((e) => console.log("Audio unlock debug:", e));
    }
  };

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

      const response = await fetch(`${API_URL}/api/debate/response`, {
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
          audioUrl: data.audio_url || undefined,
        };
        setMessages((prev) => [...prev, aiMessage]);
        console.log("AI message added:", data.message);
        
        if (data.audio_url && audioRef.current) {
          console.log("Playing AI response audio automatically:", data.audio_url);
          audioRef.current.src = data.audio_url;
          audioRef.current.play().catch((err) => {
            console.error("Autoplay failed or blocked by browser:", err);
            // Autoplay policies might block it, but they can click the speaker button next to the bubble
          });
        } else if (!data.audio_url) {
          setError("No audio available for this response.");
        }
      } else {
        setError(data.error || "Failed to get AI response from server.");
      }
    } catch (error: any) {
      console.error("API error:", error);
      let errorMessage = `Failed to connect to the server. Please ensure the backend is running on ${API_URL}.`;
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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
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
      // Manual stop
      const textToSend = currentTranscriptRef.current.trim();
      recognitionRef.current.stop();
      setIsListening(false);
      setIsUserSpeaking(false);

      if (textToSend && !hasSubmittedRef.current) {
        hasSubmittedRef.current = true;
        const newMessage: DebateMessage = {
          speaker: "user",
          message: textToSend,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
        setCurrentTranscript("");
        currentTranscriptRef.current = "";
        generateAIResponse(textToSend);
      }
    } else {
      try {
        unlockAudio(); // Unlock browser audio engine on user gesture
        hasSubmittedRef.current = false;
        transcriptAccumulatorRef.current = "";
        currentTranscriptRef.current = "";
        setCurrentTranscript("");
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
      unlockAudio(); // Unlock browser audio engine on user gesture
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
        const response = await fetch(`${API_URL}/api/debate/complete`, {
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
    <div className="min-h-screen pt-20 pb-8 bg-zinc-950 flex flex-col text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col">
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 text-red-200 rounded-lg text-sm text-center animate-fade-in">
            {error}
          </div>
        )}

        {/* Loading Indicator */}
        {isLoadingResponse && (
          <div className="mb-6 p-3 bg-indigo-955/40 border border-indigo-500/20 rounded-lg text-indigo-300 text-sm flex items-center justify-center gap-3 animate-pulse">
            <span>AI Coach is processing your argument...</span>
            <button
              onClick={cancelAIResponse}
              className="px-2 py-1 bg-red-600/80 hover:bg-red-650 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              Cancel <X size={12} />
            </button>
          </div>
        )}

        {/* Main 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          
          {/* Left Sidebar - Meta & Participant Statuses (1/3 Width) */}
          <div className="lg:col-span-1 space-y-6 flex flex-col">
            
            {/* Debate Details Card */}
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-bold border-b border-zinc-800 pb-3 text-white">Debate Session</h2>
              
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-zinc-500 block">Topic</span>
                  <span className="text-sm font-semibold text-zinc-200 block mt-0.5">{debateState.topic}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-zinc-500 block">Your Stance</span>
                    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mt-1 ${
                      debateState.stance === "Support" 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {debateState.stance}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 block">Complexity Level</span>
                    <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/50 mt-1">
                      {debateState.level || "Intermediate"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Participants Status Card */}
            <div className="glass-card rounded-xl p-5 space-y-4 flex-1">
              <h2 className="text-lg font-bold border-b border-zinc-800 pb-3 text-white">Debating Parties</h2>
              
              <div className="space-y-6 pt-2">
                {/* User Status */}
                <div className="flex items-center gap-4">
                  <div className={`relative p-0.5 rounded-full ${
                    isListening ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-950 animate-pulse" : ""
                  }`}>
                    <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <User size={24} className="text-indigo-400" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">You</h4>
                    <p className="text-xs text-zinc-500">Stance: {debateState.stance}</p>
                    {isListening && (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Speaking...
                      </span>
                    )}
                  </div>
                </div>

                {/* VS Divider */}
                <div className="flex items-center justify-between text-zinc-700">
                  <div className="border-t border-zinc-800/80 flex-1"></div>
                  <span className="text-xs font-mono font-bold px-3">VS</span>
                  <div className="border-t border-zinc-800/80 flex-1"></div>
                </div>

                {/* AI Status */}
                <div className="flex items-center gap-4">
                  <div className={`relative p-0.5 rounded-full ${
                    isAISpeaking || isLoadingResponse ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-950 animate-pulse" : ""
                  }`}>
                    <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Bot size={24} className="text-indigo-400" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">AI Coach</h4>
                    <p className="text-xs text-zinc-500">Stance: {debateState.stance === "Support" ? "Oppose" : "Support"}</p>
                    {(isAISpeaking || isLoadingResponse) && (
                      <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span> Thinking...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Timer and End Button Card */}
            <div className="glass-card rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Time Remaining</span>
                <div className="flex items-center gap-1.5 text-lg font-bold">
                  <Clock size={16} className="text-indigo-400" />
                  <span className={timeRemaining < 60 ? "text-red-400 animate-pulse" : "text-white"}>
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
              
              <button
                onClick={endDebate}
                className="w-full py-2.5 bg-red-600/90 hover:bg-red-650 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-red-600/10"
              >
                End Debate Early
              </button>
            </div>

          </div>

          {/* Right Area - Spacious Debate Chat Arena (2/3 Width) */}
          <div className="lg:col-span-2 glass-card rounded-xl p-6 flex flex-col h-[650px] shadow-2xl border border-zinc-800/80">
            
            {/* Arena Header */}
            <div className="border-b border-zinc-800 pb-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isListening ? "bg-emerald-500 animate-pulse" : "bg-indigo-500"}`}></span>
                <h3 className="font-bold text-white tracking-tight">Debate Arena</h3>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {messages.length} {messages.length === 1 ? "turn" : "turns"} completed
              </span>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center gap-2">
                  <Bot size={48} className="text-zinc-750 mb-2" />
                  <p className="text-zinc-300 font-semibold">Start the debate!</p>
                  <p className="text-xs max-w-xs text-zinc-500 leading-relaxed">
                    Click the Microphone button to record your speech, or type your opening argument in the input box below.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.speaker === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-xl border ${
                        message.speaker === "user"
                          ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-100 rounded-tr-none"
                          : "bg-zinc-900 border-zinc-800 text-zinc-100 rounded-tl-none"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5 opacity-80">
                        <div className="flex items-center gap-2">
                          {message.speaker === "user" ? (
                            <User size={13} className="text-indigo-400" />
                          ) : (
                            <Bot size={13} className="text-zinc-400" />
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {message.speaker === "user" ? "You" : "AI Coach"}
                          </span>
                        </div>
                        
                        {message.speaker === "ai" && message.audioUrl && (
                          <button
                            onClick={() => {
                              if (audioRef.current && message.audioUrl) {
                                console.log("Manually playing audio:", message.audioUrl);
                                audioRef.current.src = message.audioUrl;
                                audioRef.current.play().catch((err: any) => {
                                  console.error("Manual audio playback error:", err);
                                  if (err.name === "NotSupportedError" || err.message?.includes("source") || err.message?.includes("supported")) {
                                    setError("Audio file not found on the server (404). If you are testing the deployed app, please push the code changes to GitHub first so Render updates to the new in-memory audio engine.");
                                  } else {
                                    setError("Unable to play audio. Check speaker settings or browser permissions.");
                                  }
                                });
                              }
                            }}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-indigo-400 hover:text-indigo-300 transition-colors"
                            title="Play/Replay Audio"
                          >
                            <Volume2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Interim Live Transcript Indicator */}
            {currentTranscript && (
              <div className="mb-4 p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-lg animate-pulse">
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-0.5">
                  Speaking / Transcribing...
                </p>
                <p className="text-zinc-200 text-sm leading-relaxed">{currentTranscript}</p>
              </div>
            )}

            {/* Toolbar: Mic & Fallback text input */}
            <div className="border-t border-zinc-800 pt-4 mt-auto">
              <div className="flex items-center gap-3">
                
                {/* Voice Microphone Toggle Button */}
                <button
                  onClick={toggleListening}
                  disabled={!recognitionRef.current || isLoadingResponse}
                  title={isListening ? "Stop recording speech" : "Record your speech"}
                  className={`p-3.5 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isListening
                      ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/40"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {/* Text Fallback input field */}
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoadingResponse) {
                      handleTextSubmit();
                    }
                  }}
                  disabled={isLoadingResponse}
                  placeholder={
                    isListening
                      ? "I am listening... stop recording or pause when done."
                      : "Type your argument here and click Send..."
                  }
                  className="flex-1 p-3.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
                />

                {/* Send Button */}
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || isLoadingResponse}
                  title="Send written argument"
                  className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>

              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default LiveDebate;
