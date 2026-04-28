import { ReactNode, useEffect, useState } from 'react';
import logo from '@/assets/tlc-connect-logo.png';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Home,
  MessageSquare,
  Users,
  Coins,
  Gift,
  Building2,
  User,
  LogOut,
  Shield,
  UserPlus,
  Menu,
} from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const menuItems = [
    { path: '/feed', label: 'Feed', icon: Home },
    { path: '/groups', label: 'Groups', icon: Users },
    { path: '/people', label: 'People', icon: UserPlus },
    { path: '/earn', label: 'Earn', icon: Coins },
    { path: '/nfts', label: 'NFTs', icon: Gift },
    { path: '/organizations', label: 'Organizations', icon: Building2 },
  ];

  const isActive = (path: string) => location.pathname === path;
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const requestLogout = () => {
    setMenuOpen(false);
    setLogoutOpen(true);
  };

  const confirmLogout = () => {
    setLogoutOpen(false);
    signOut();
  };

  const handleNav = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:px-4">
          <div
            className="flex items-center space-x-2 cursor-pointer min-w-0"
            onClick={() => navigate('/')}
          >
            <img
              src={logo}
              alt="TLC-Connect logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shadow-glow object-contain shrink-0"
            />
            <span className="hidden sm:inline font-bold text-lg sm:text-xl bg-gradient-primary bg-clip-text text-transparent truncate">
              TLC-Connect
            </span>
          </div>

          {/* Desktop nav: only on lg+ to avoid tablet overflow */}
          <nav className="hidden lg:flex items-center space-x-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Button
                  key={item.path}
                  variant={active ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <NotificationBell />
            <ThemeToggle />

            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:inline-flex"
                onClick={() => navigate('/admin')}
              >
                <Shield className="h-5 w-5" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => navigate('/profile')}
            >
              <User className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={requestLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>

            {/* Mobile/tablet menu button (replaces overflow icons) */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] flex flex-col">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto mt-4 space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Button
                        key={item.path}
                        variant={active ? 'default' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => handleNav(item.path)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Button>
                    );
                  })}
                  <div className="h-px bg-border my-3" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleNav('/profile')}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleNav('/admin')}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Admin
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={requestLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Bottom nav: shows on mobile + tablet (< lg). Scrolls horizontally if needed so all items are reachable. */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg">
        <div className="flex justify-around items-center h-16 px-1 overflow-x-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={`flex flex-col items-center justify-center gap-0.5 h-14 min-w-[60px] px-2 shrink-0 ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
                onClick={() => navigate(item.path)}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 lg:pb-6 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
