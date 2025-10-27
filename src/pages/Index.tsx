import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, MessageSquare, Gift, Award, TrendingUp, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/feed');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-accent/20 to-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Welcome to TLC-Connect
          </h1>
          <p className="text-xl text-muted-foreground">
            The blockchain-powered social platform for students, teachers, and organizations. Connect, learn, and earn
            rewards together.
          </p>
          <div className="flex items-center justify-center space-x-4 pt-6">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Learn More
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="p-6 space-y-4 hover:shadow-elegant transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Social Networking</h3>
            <p className="text-muted-foreground">
              Connect with peers, join groups, and engage in meaningful discussions.
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-elegant transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Discussion Forums</h3>
            <p className="text-muted-foreground">
              Create threads, share knowledge, and collaborate on academic topics.
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-elegant transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Token Rewards</h3>
            <p className="text-muted-foreground">Earn tokens for participation and engagement on the platform.</p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-elegant transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">NFT Marketplace</h3>
            <p className="text-muted-foreground">
              Purchase exclusive NFTs and digital collectibles with your earned tokens.
            </p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-elegant transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Blockchain Integration</h3>
            <p className="text-muted-foreground">Connect your Web3 wallet and experience true digital ownership.</p>
          </Card>

          <Card className="p-6 space-y-4 hover:shadow-elegant transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Secure & Private</h3>
            <p className="text-muted-foreground">
              Your data is protected with enterprise-grade security and encryption.
            </p>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="p-12 text-center bg-gradient-primary">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Join the Community?</h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Create your account today and start connecting with thousands of students and educators.
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate("/auth")}>
            Sign Up Now
          </Button>
        </Card>
      </div>
    </div>
  );
}
