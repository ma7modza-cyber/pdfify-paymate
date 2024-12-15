import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingCardProps {
  conversionId?: string;
  onPaymentInitiated?: () => void;
}

const PricingCard = ({ conversionId, onPaymentInitiated }: PricingCardProps) => {
  const handlePayment = async (paymentMethod: 'stripe' | 'paypal') => {
    try {
      if (!conversionId) {
        toast.error("Please upload a file first");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      const response = await fetch('/functions/v1/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          conversionId,
          paymentMethod 
        }),
      });

      const { url, error } = await response.json();
      
      if (error) {
        throw new Error(error);
      }

      if (url) {
        onPaymentInitiated?.();
        window.location.href = url;
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error("Failed to initiate payment");
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold text-blue-900 mb-4">Simple Pricing</h2>
      <div className="mb-6">
        <div className="text-3xl font-bold text-blue-900">$1.99</div>
        <div className="text-gray-500">per conversion</div>
      </div>
      
      <ul className="space-y-3 mb-6">
        {[
          'High-quality PDF conversion',
          'Instant download',
          'Secure processing',
          'Support for Excel & Word files'
        ].map((feature, index) => (
          <li key={index} className="flex items-center text-gray-600">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={() => handlePayment('stripe')}
        >
          Pay with Card
        </Button>

        <Button 
          className="w-full bg-[#0070ba] hover:bg-[#003087]"
          onClick={() => handlePayment('paypal')}
        >
          Pay with PayPal
        </Button>
      </div>
      
      <div className="mt-4 text-center text-sm text-gray-500">
        Secure payment powered by Stripe & PayPal
      </div>
    </Card>
  );
};

export default PricingCard;