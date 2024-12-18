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
    const accessToken = urlParams.get('access_token');
    const type = urlParams.get('type');
    
    if (paymentSuccess === 'true') {
      toast.success('Payment successful!');
      // Remove the query parameters and reload the page
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    }

    // Handle email confirmation
    if (type === 'recovery' || type === 'signup' || type === 'magiclink') {
      handleEmailConfirmation(accessToken);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
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
        navigate('/');
        toast.success('Successfully signed in!');
        // Reload the page after successful sign in
        window.location.reload();
      } else if (_event === 'SIGNED_OUT') {
        navigate('/auth');
        toast.success('Successfully signed out!');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location]);

  const handleEmailConfirmation = async (accessToken: string | null) => {
    if (!accessToken) return;

    try {
      const { error } = await supabase.auth.getUser(accessToken);
      if (error) throw error;
      
      toast.success('Email confirmed successfully!');
      navigate('/');
      window.location.reload();
    } catch (error) {
      console.error('Error confirming email:', error);
      toast.error('Failed to confirm email. Please try again.');
      navigate('/auth');
    }
  };

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