import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Coins, Image as ImageIcon, TrendingUp, Shield, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/tlc-connect-logo.png";

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/feed");
    }
  }, [user, loading, navigate]);

  const features = [
    {
      icon: Users,
      title: "Social Networking",
      desc: "Connect with peers, join groups, and engage in meaningful discussions.",
    },
    {
      icon: Coins,
      title: "Tokens",
      desc: "Earn $TLC test tokens for participation and claim them straight to your wallet.",
    },
    {
      icon: ImageIcon,
      title: "NFTs",
      desc: "Spend your earned tokens to mint exclusive NFTs and digital collectibles.",
    },
    {
      icon: TrendingUp,
      title: "Blockchain Integration",
      desc: "Connect your Web3 wallet and experience true digital ownership on Polygon.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      desc: "Your data is protected with enterprise-grade security and encryption.",
    },
    {
      icon: Sparkles,
      title: "Learn by Doing",
      desc: "Explore how Web3 works through real, hands-on interactions inside your school.",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-16 md:pt-24 pb-24">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <div className="relative mb-8">
            <img
              src={logo}
              alt="TLC-Connect logo"
              className="w-28 h-28 md:w-32 md:h-32 rounded-3xl shadow-glow object-contain"
            />
            <span className="absolute inset-0 rounded-3xl ring-1 ring-primary/20 pointer-events-none" />
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent leading-[1.05] mb-6">
            <span className="block">Welcome to</span>
            <span className="block">TLC-Connect</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            The social platform for students, teachers, and organizations of The Lewis College.
            Connect, learn, and explore how blockchain works — together.
          </p>

          <Button size="lg" className="group" onClick={() => navigate("/auth")}>
            Get Started
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-20">
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold">Platform Features</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Everything you need to socialize, earn, and explore Web3 — all in one place.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card
              key={title}
              className="group p-6 space-y-4 border-border/60 bg-card/60 backdrop-blur hover:shadow-elegant hover:-translate-y-1 hover:border-primary/30 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-primary/10 bg-primary/10 flex items-center justify-center ring-1 ring-primary/15 group-hover:scale-110 transition-transform">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="text-muted-foreground leading-relaxed">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-20">
        <Card className="relative overflow-hidden p-10 md:p-14 text-center bg-gradient-primary border-0">
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Join the Community?
            </h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">
              Connect your TLC account today and start engaging with thousands of students and educators.
            </p>
            <Button size="lg" variant="secondary" className="group" onClick={() => navigate("/auth?view=signup")}>
              Sign Up Now
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
