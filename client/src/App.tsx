import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/AuthProvider";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { Loader2 } from "lucide-react";
import Home from "@/pages/Home";
import Games from "@/pages/Games";
import About from "@/pages/About";
import UploadGame from "@/pages/UploadGame";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/not-found";

// Protected Route wrapper - redirects to login if not authenticated
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Login is accessible to everyone */}
      <Route path="/login">
        {user ? <Redirect to="/" /> : <Login />}
      </Route>

      {/* All other routes require authentication */}
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/games">
        <ProtectedRoute component={Games} />
      </Route>
      <Route path="/about">
        <ProtectedRoute component={About} />
      </Route>
      <Route path="/u">
        <ProtectedRoute component={UploadGame} />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route>
        <ProtectedRoute component={NotFound} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
