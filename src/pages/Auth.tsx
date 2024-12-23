import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthChangeEvent } from "@supabase/supabase-js";

const AuthPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      console.log("Auth state changed:", event);
      if (session) {
        navigate("/");
      }
      
      // Handle various auth events
      switch (event) {
        case 'SIGNED_IN':
          toast.success('Successfully signed in!');
          break;
        case 'SIGNED_OUT':
          toast.success('Successfully signed out!');
          break;
        case 'PASSWORD_RECOVERY':
          toast.info('Password recovery email sent');
          break;
        case 'TOKEN_REFRESHED':
          console.log('Token refreshed');
          break;
        case 'USER_UPDATED':
          toast.success('Profile updated');
          break;
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-blue-900 mb-6 text-center">
          Welcome to PDF Converter
        </h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb',
                  brandAccent: '#1d4ed8',
                }
              }
            }
          }}
          providers={[]}
          view="sign_up"
          showLinks={true}
          redirectTo={`${window.location.origin}/`}
        />
      </div>
    </div>
  );
};

export default AuthPage;