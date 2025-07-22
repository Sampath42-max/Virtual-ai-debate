
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
    <div className="min-h-screen pt-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            {/* Floating Animation Elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/10 rounded-full animate-float blur-xl"></div>
              <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-pink-500/10 rounded-full animate-float blur-xl" style={{ animationDelay: '2s' }}></div>
              <div className="absolute bottom-1/4 left-1/3 w-40 h-40 bg-blue-500/10 rounded-full animate-float blur-xl" style={{ animationDelay: '4s' }}></div>
            </div>

            <div className="relative z-10">
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                <span className="gradient-text">Virtual AI</span>
                <br />
                <span className="text-white">Debate Coach</span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Master the art of debate with AI-powered coaching. Practice, learn, and improve your communication skills in real-time.
              </p>

              <div className="gradient-border inline-block rounded-lg">
                <button
                  onClick={() => navigate("/topics")}
                  className="px-8 py-4 bg-black/50 rounded-lg text-white font-semibold text-lg flex items-center gap-3 hover:bg-black/70 transition-all duration-300 group"
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
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-card rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-8">
              What is <span className="gradient-text">Virtual AI Debate Coach</span>?
            </h2>
            <p className="text-lg text-gray-300 text-center max-w-4xl mx-auto leading-relaxed">
              Our AI-powered debate coach provides a safe, interactive environment where you can practice your debating skills on various topics. 
              Whether you're preparing for a formal debate, improving your public speaking, or simply want to sharpen your argumentative skills, 
              our AI coach adapts to your level and provides personalized feedback to help you grow.
            </p>
          </div>
        </div>
      </section>

      {/* Key Benefits Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Key <span className="gradient-text">Benefits</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={index}
                  className="glass-card rounded-xl p-6 hover:bg-white/15 transition-all duration-300 transform hover:-translate-y-2 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2 text-white">
                        {benefit.title}
                      </h3>
                      <p className="text-gray-300 leading-relaxed">
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
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="glass-card rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to <span className="gradient-text">Start Debating</span>?
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Join thousands of users who have improved their communication skills with our AI coach.
            </p>
            <div className="gradient-border inline-block rounded-lg">
              <button
                onClick={() => navigate("/topics")}
                className="px-8 py-4 bg-black/50 rounded-lg text-white font-semibold text-lg flex items-center gap-3 hover:bg-black/70 transition-all duration-300 group"
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
