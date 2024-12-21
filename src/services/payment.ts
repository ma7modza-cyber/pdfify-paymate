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

    // First, verify the conversion exists and belongs to the user
    const { data: conversion, error: conversionError } = await supabase
      .from('conversions')
      .select('*')
      .eq('id', conversionId)
      .eq('user_id', session.user.id)
      .single();

    if (conversionError || !conversion) {
      console.error('Failed to fetch conversion:', conversionError);
      console.log('Conversion ID being checked:', conversionId);
      toast.error("Invalid conversion record");
      return;
    }

    if (conversion.payment_status === 'paid') {
      console.log('Conversion already paid for');
      toast.error("This conversion has already been paid for");
      return;
    }

    console.log('Found conversion record:', conversion);
    console.log('Initiating payment for conversion:', conversionId);
    
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: JSON.stringify({ conversionId }),
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
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
    
    // Use window.location.href for the redirect
    window.location.href = data.url;
    
  } catch (error) {
    console.error('Payment error:', error);
    toast.error("An unexpected error occurred. Please try again.");
  }
};