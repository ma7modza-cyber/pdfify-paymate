import { Card } from "@/components/ui/card";
import FileUploader from "@/components/FileUploader";
import PricingCard from "@/components/PricingCard";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface ConversionContainerProps {
  isProcessing: boolean;
  conversionId: string | null;
  conversionStatus: string;
  convertedFilePath: string | null;
  onFileSelect: (file: File) => void;
  onDownload: () => void;
}

const ConversionContainer = ({
  isProcessing,
  conversionId,
  conversionStatus,
  convertedFilePath,
  onFileSelect,
  onDownload
}: ConversionContainerProps) => {
  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
      <Card className="p-6">
        <FileUploader 
          onFileSelect={onFileSelect}
          isProcessing={isProcessing}
        />
        {conversionStatus === 'completed' && convertedFilePath && (
          <div className="mt-4 flex justify-center">
            <Button
              onClick={onDownload}
              className="bg-green-500 hover:bg-green-600"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Converted PDF
            </Button>
          </div>
        )}
        {isProcessing && (
          <div className="mt-4 flex items-center justify-center text-blue-600">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>Converting your file...</span>
          </div>
        )}
      </Card>

      <PricingCard 
        conversionId={conversionId}
        onPaymentInitiated={() => {}}
      />
    </div>
  );
};

export default ConversionContainer;