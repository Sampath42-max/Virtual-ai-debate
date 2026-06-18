import { ArrowRight, Brain, MessageSquare, Trophy, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: MessageSquare,
      title: "Improve Communication Skills",
      description: "Practice articulating your thoughts clearly and persuasively",
    },
    {
      icon: Brain,
      title: "Real-time AI Interaction",
      description: "Engage with intelligent AI that adapts to your arguments",
    },
    {
      icon: Trophy,
      title: "Structured Debating",
      description: "Learn proper debate techniques and logical reasoning",
    },
    {
      icon: Zap,
      title: "Instant Feedback",
      description: "Get immediate performance analysis and improvement tips",
    },
  ];

  return (
    <div className="min-h-screen pt-16 bg-zinc-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="relative z-10">
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                <span className="gradient-text">Virtual AI</span>
                <br />
                <span className="text-white">Debate Coach</span>
              </h1>

              <p className="text-xl md:text-2xl text-zinc-400 mb-8 max-w-3xl mx-auto">
                Master the art of debate with AI-powered coaching. Practice, learn, and improve your communication skills in real-time.
              </p>

              <div className="inline-block">
                <button
                  onClick={() => navigate("/topics")}
                  className="px-8 py-4 bg-indigo-600 rounded-lg text-white font-semibold text-lg flex items-center gap-3 hover:bg-indigo-700 transition-all duration-300 shadow-lg shadow-indigo-600/10 group"
                >
                  Get Started
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What is Virtual AI Debate Coach Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-card rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-white">
              What is <span className="gradient-text">Virtual AI Debate Coach</span>?
            </h2>
            <p className="text-lg text-zinc-400 text-center max-w-4xl mx-auto leading-relaxed">
              Our AI-powered debate coach provides a safe, interactive environment where you can practice your debating skills on various topics. 
              Whether you're preparing for a formal debate, improving your public speaking, or simply want to sharpen your argumentative skills, 
              our AI coach adapts to your level and provides personalized feedback to help you grow.
            </p>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white">
            Key <span className="gradient-text">Benefits</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={index}
                  className="glass-card rounded-xl p-6 hover:bg-zinc-900/80 transition-all duration-300 transform hover:-translate-y-1 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon size={24} className="text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2 text-white">
                        {benefit.title}
                      </h3>
                      <p className="text-zinc-400 leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="glass-card rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
              Ready to <span className="gradient-text">Start Debating</span>?
            </h2>
            <p className="text-lg text-zinc-400 mb-8">
              Join thousands of users who have improved their communication skills with our AI coach.
            </p>
            <div className="inline-block">
              <button
                onClick={() => navigate("/topics")}
                className="px-8 py-4 bg-indigo-600 rounded-lg text-white font-semibold text-lg flex items-center gap-3 hover:bg-indigo-700 transition-all duration-300 shadow-lg shadow-indigo-600/10 group"
              >
                Begin Your Journey
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
