import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

const PricingCard = () => {
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
        className="w-full bg-blue-600 hover:bg-blue-700"
        onClick={() => {
          // Stripe integration will go here
          alert('Stripe integration coming soon!');
        }}
      >
        Convert Now
      </Button>
      
      <div className="mt-4 text-center text-sm text-gray-500">
        Secure payment powered by Stripe
      </div>
    </Card>
  );
};

export default PricingCard;