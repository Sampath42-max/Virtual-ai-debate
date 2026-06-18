import { useState } from "react";
import { ArrowRight, Clock, Users, BarChart2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SelectionState {
  topic: string;
  duration: number;
  stance: string;
  level: string;
}

const TopicSelection = () => {
  const navigate = useNavigate();
  const [selections, setSelections] = useState<SelectionState>({
    topic: "",
    duration: 0,
    stance: "",
    level: "",
  });

  const topics = [
    "Politics' impact on people",
    "Education system in India",
    "Movies' impact on children and teenagers",
    "Work from home vs work from office",
    "Climate change and government policy",
    "AI replacing human jobs",
    "Social media's effect on mental health",
    "Online privacy vs public safety",
    "Cryptocurrency and the future of money",
    "E-learning vs traditional classroom",
    "Impact of fast fashion on environment",
    "Universal basic income",
    "Gender equality in workplace",
    "Influence of influencers on youth",
  ];

  const durations = [2, 5, 10];
  const stances = ["Support", "Oppose"];
  const levels = ["Beginner", "Intermediate", "Advanced", "Expert"];

  const handleProceed = () => {
    if (selections.topic && selections.duration && selections.stance && selections.level) {
      navigate("/debate", { state: selections });
    }
  };

  const isComplete = selections.topic && selections.duration && selections.stance && selections.level;

  return (
    <div className="min-h-screen pt-16 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Choose Your <span className="gradient-text">Debate Topic</span>
          </h1>
          <p className="text-lg text-zinc-400">
            Select your preferences to customize your debate experience
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Selection Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Topic Selection */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
                <Users className="text-indigo-400" size={24} />
                Select Topic
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topics.map((topic, index) => (
                  <button
                    key={index}
                    onClick={() => setSelections({ ...selections, topic })}
                    className={`p-4 rounded-lg text-left transition-all duration-200 border ${
                      selections.topic === topic
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-200"
                        : "bg-zinc-900/40 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selection */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
                <Clock className="text-indigo-400" size={24} />
                Debate Duration
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {durations.map((duration) => (
                  <button
                    key={duration}
                    onClick={() => setSelections({ ...selections, duration })}
                    className={`p-4 rounded-lg text-center font-medium transition-all duration-200 border ${
                      selections.duration === duration
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-200"
                        : "bg-zinc-900/40 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    {duration} min
                  </button>
                ))}
              </div>
            </div>

            {/* Stance Selection */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-2xl font-semibold mb-4 text-white">Your Position</h2>
              <div className="grid grid-cols-2 gap-4">
                {stances.map((stance) => (
                  <button
                    key={stance}
                    onClick={() => setSelections({ ...selections, stance })}
                    className={`p-4 rounded-lg text-center font-medium transition-all duration-200 border ${
                      selections.stance === stance
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-200"
                        : "bg-zinc-900/40 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    {stance}
                  </button>
                ))}
              </div>
            </div>

            {/* Debate Level Selection */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-2xl font-semibold mb-4 text-white flex items-center gap-2">
                <BarChart2 className="text-indigo-400" size={24} />
                Debate Level
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {levels.map((level) => (
                  <button
                    key={level}
                    onClick={() => setSelections({ ...selections, level })}
                    className={`p-4 rounded-lg text-center font-medium transition-all duration-200 border ${
                      selections.level === level
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-200"
                        : "bg-zinc-900/40 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800/60"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview Summary */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-xl p-6 sticky top-24">
              <h2 className="text-2xl font-semibold mb-6 text-white">Your Selections</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                  <p className="text-sm text-zinc-500 mb-1">Topic</p>
                  <p className="text-white font-medium">
                    {selections.topic || "Not selected"}
                  </p>
                </div>

                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                  <p className="text-sm text-zinc-500 mb-1">Duration</p>
                  <p className="text-white font-medium">
                    {selections.duration ? `${selections.duration} minutes` : "Not selected"}
                  </p>
                </div>

                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                  <p className="text-sm text-zinc-500 mb-1">Position</p>
                  <p className="text-white font-medium">
                    {selections.stance || "Not selected"}
                  </p>
                </div>

                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                  <p className="text-sm text-zinc-500 mb-1">Debate Level</p>
                  <p className="text-white font-medium">
                    {selections.level || "Not selected"}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleProceed}
                  disabled={!isComplete}
                  className={`w-full px-6 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-300 border ${
                    isComplete
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600 shadow-lg shadow-indigo-600/10"
                      : "bg-zinc-800/50 text-zinc-500 border-zinc-800 cursor-not-allowed"
                  }`}
                >
                  Proceed to Start Debate
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicSelection;
