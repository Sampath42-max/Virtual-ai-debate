
import { useLocation, useNavigate } from "react-router-dom";
import { Star, Trophy, MessageSquare, Clock, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

interface PerformanceData {
  totalMessages: number;
  totalWords: number;
  avgResponseTime: number;
  topic: string;
  duration: number;
}

const FeedbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const performanceData = location.state as PerformanceData;
  
  const [rating, setRating] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (performanceData) {
      // Calculate rating based on performance
      let calculatedRating = 2; // Base rating
      
      // Add points for message count
      if (performanceData.totalMessages > 5) calculatedRating += 1;
      if (performanceData.totalMessages > 10) calculatedRating += 1;
      
      // Add points for word count
      if (performanceData.totalWords > 50) calculatedRating += 0.5;
      if (performanceData.totalWords > 100) calculatedRating += 0.5;
      
      // Cap at 5 stars
      const finalRating = Math.min(5, Math.max(1, Math.round(calculatedRating)));
      
      // Animate the rating
      setTimeout(() => {
        setRating(finalRating);
        setShowAnimation(true);
      }, 500);
    }
  }, [performanceData]);

  if (!performanceData) {
    navigate("/topics");
    return null;
  }

  const getRatingMessage = (stars: number) => {
    switch (stars) {
      case 1:
        return "Keep practicing! Every debate is a learning opportunity.";
      case 2:
        return "Good effort! Work on expanding your arguments.";
      case 3:
        return "Fair performance! Try to engage more actively.";
      case 4:
        return "Great job! Your communication skills are improving.";
      case 5:
        return "Excellent performance! Outstanding engagement and clarity.";
      default:
        return "Keep practicing!";
    }
  };

  const getRatingCategory = (stars: number) => {
    switch (stars) {
      case 1:
        return "Needs Improvement";
      case 2:
        return "Poor Communication";
      case 3:
        return "Fair Effort";
      case 4:
        return "Good Clarity & Response";
      case 5:
        return "Excellent Engagement";
      default:
        return "Needs Improvement";
    }
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-green-500/20 rounded-full mb-6">
            <Trophy size={48} className="text-green-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Debate Complete!</span>
          </h1>
          <p className="text-lg text-gray-300">
            Here's your performance summary
          </p>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="glass-card rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={24} className="text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {performanceData.totalMessages}
            </div>
            <div className="text-gray-400">Messages Sent</div>
          </div>

          <div className="glass-card rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={24} className="text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {performanceData.totalWords}
            </div>
            <div className="text-gray-400">Total Words</div>
          </div>

          <div className="glass-card rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={24} className="text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-2">
              {performanceData.duration}
            </div>
            <div className="text-gray-400">Minutes Debated</div>
          </div>
        </div>

        {/* Rating Section */}
        <div className="glass-card rounded-xl p-8 mb-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-6">Your Performance Rating</h2>
            
            <div className="mb-6">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={40}
                    className={`transition-all duration-500 ${
                      star <= rating
                        ? showAnimation
                          ? "text-yellow-400 fill-yellow-400 animate-pulse"
                          : "text-yellow-400 fill-yellow-400"
                        : "text-gray-600"
                    }`}
                    style={{ 
                      animationDelay: showAnimation ? `${star * 100}ms` : '0ms'
                    }}
                  />
                ))}
              </div>
              <div className="text-xl font-semibold text-yellow-400 mb-2">
                {getRatingCategory(rating)}
              </div>
              <p className="text-gray-300 max-w-md mx-auto">
                {getRatingMessage(rating)}
              </p>
            </div>
          </div>
        </div>

        {/* Debate Summary */}
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Debate Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Topic:</span>
              <span className="text-white font-medium">{performanceData.topic}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Duration:</span>
              <span className="text-white font-medium">{performanceData.duration} minutes</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Participation:</span>
              <span className="text-white font-medium">
                {performanceData.totalMessages > 5 ? "Active" : "Moderate"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate("/topics")}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Start New Debate
            <ArrowRight size={20} />
          </button>
          
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/20"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
