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
  const handlePayment = async () => {
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

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { conversionId }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.url) {
        onPaymentInitiated?.();
        window.location.href = data.url;
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

      <Button 
        className="w-full bg-[#0070ba] hover:bg-[#003087]"
        onClick={handlePayment}
      >
        Pay with PayPal
      </Button>
      
      <div className="mt-4 text-center text-sm text-gray-500">
        Secure payment powered by PayPal
      </div>
    </Card>
  );
};

export default PricingCard;