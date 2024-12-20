import { useState } from "react";
import { initiatePayment } from "@/services/payment";

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async (conversionId?: string) => {
    setIsLoading(true);
    await initiatePayment({
      conversionId,
      onPaymentInitiated: () => setIsLoading(true),
    });
    setIsLoading(false);
  };

  return {
    isLoading,
    handlePayment,
  };
};