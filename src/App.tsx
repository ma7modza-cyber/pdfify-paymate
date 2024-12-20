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

const useAuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuthRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && location.pathname === '/auth') {
        console.log("Redirecting authenticated user from /auth to /");
        navigate('/');
      }
    };

    handleAuthRedirect();
  }, [navigate, location]);
};

const usePaymentStatus = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const paymentCancelled = urlParams.get('payment_cancelled');
    const conversionId = urlParams.get('conversion_id');
    
    const handleSuccessfulPayment = async (conversionId: string) => {
      try {
        console.log("Processing conversion after successful payment:", conversionId);
        
        // Update payment status
        const { error: updateError } = await supabase
          .from('conversions')
          .update({ payment_status: 'paid' })
          .eq('id', conversionId);

        if (updateError) {
          console.error('Failed to update payment status:', updateError);
          toast.error('Failed to process payment. Please contact support.');
          return;
        }

        // Start conversion process
        const { error: conversionError } = await supabase.functions.invoke('process-conversion', {
          body: { conversionId }
        });

        if (conversionError) {
          console.error('Conversion error:', conversionError);
          toast.error('Failed to start conversion. Please try again.');
          return;
        }

        toast.success('Payment successful! Your conversion will begin shortly.');
      } catch (error) {
        console.error('Payment processing error:', error);
        toast.error('An error occurred while processing your payment.');
      }
    };
    
    if (paymentSuccess === 'true' && conversionId) {
      console.log("Payment successful, processing conversion");
      handleSuccessfulPayment(conversionId);
      window.history.replaceState({}, '', window.location.pathname);
      navigate('/', { replace: true });
    } else if (paymentCancelled === 'true') {
      console.log("Payment cancelled, showing error toast");
      toast.error('Payment was cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [navigate]);
};

const useAuthState = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailConfirmation = () => {
      const hash = window.location.hash;
      if (hash && (hash.includes('type=signup') || hash.includes('type=recovery') || hash.includes('type=magiclink'))) {
        console.log("Detected auth redirect with hash:", hash);
        toast.success('Processing authentication...');
      }
    };

    handleEmailConfirmation();

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Current session:", session);
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state changed:", _event);
      setSession(session);
      
      if (_event === 'SIGNED_IN') {
        console.log("User signed in, redirecting to home");
        toast.success('Successfully signed in!');
        navigate('/', { replace: true });
      } else if (_event === 'SIGNED_OUT') {
        console.log("User signed out, redirecting to auth");
        navigate('/auth', { replace: true });
        toast.success('Successfully signed out!');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { session, loading };
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuthState();
  useAuthRedirect();
  usePaymentStatus();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    console.log("No session found, redirecting to auth");
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