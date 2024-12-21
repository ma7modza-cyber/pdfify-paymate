import { useState } from "react";
import { initiatePayment } from "@/services/payment";
import { toast } from "sonner";

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async (conversionId?: string) => {
    try {
      setIsLoading(true);
      console.log('Starting payment process for conversion:', conversionId);
      
      await initiatePayment({
        conversionId,
        onPaymentInitiated: () => {
          console.log('Payment initiated successfully');
          setIsLoading(true);
        },
      });
    } catch (error) {
      console.error('Payment handling error:', error);
      toast.error("Failed to process payment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handlePayment,
  };
};