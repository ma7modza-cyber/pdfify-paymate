import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PaymentInitiateParams {
  conversionId?: string;
  onPaymentInitiated?: () => void;
}

export const initiatePayment = async ({ conversionId, onPaymentInitiated }: PaymentInitiateParams) => {
  try {
    if (!conversionId) {
      console.error('No conversion ID provided');
      toast.error("Please upload a file first");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('No session found');
      toast.error("Please sign in to continue");
      return;
    }

    console.log('Initiating payment for conversion:', conversionId);
    
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { conversionId },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      console.error('Payment initialization error:', error);
      toast.error("Payment initialization failed. Please try again later.");
      return;
    }

    if (!data?.url) {
      console.error('No payment URL received');
      toast.error("Could not start payment process. Please try again.");
      return;
    }

    console.log('Payment URL received:', data.url);
    onPaymentInitiated?.();
    window.location.href = data.url;
    
  } catch (error) {
    console.error('Payment error:', error);
    toast.error("An unexpected error occurred. Please try again.");
  }
};