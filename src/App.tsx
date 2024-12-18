import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check URL parameters for payment success
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    
    if (paymentSuccess === 'true') {
      toast.success('Payment successful!');
      // Remove the query parameters and reload the page
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    }

    // Handle email confirmation
    const hash = window.location.hash;
    if (hash && hash.includes('type=signup') || hash.includes('type=recovery') || hash.includes('type=magiclink')) {
      console.log("Detected auth redirect with hash:", hash);
      // The email confirmation will be handled automatically by Supabase
      toast.success('Processing authentication...');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Current session:", session);
      setSession(session);
      setLoading(false);
      
      // If user is already signed in and on auth page, redirect to home
      if (session && location.pathname === '/auth') {
        navigate('/');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event);
      setSession(session);
      
      if (_event === 'SIGNED_IN') {
        toast.success('Successfully signed in!');
        navigate('/');
        // Add a small delay before reloading to ensure the toast is shown
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else if (_event === 'SIGNED_OUT') {
        navigate('/auth');
        toast.success('Successfully signed out!');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/auth" />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;