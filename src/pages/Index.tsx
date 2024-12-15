import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FileUploader from '@/components/FileUploader';
import PricingCard from '@/components/PricingCard';
import { toast } from "sonner";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [convertedFile, setConvertedFile] = useState<string | null>(null);

  const handleConversion = async (file: File) => {
    setIsProcessing(true);
    try {
      // In a real implementation, we would send the file to a backend service
      // For now, we'll simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success("File converted successfully!");
      setConvertedFile("dummy-converted.pdf");
    } catch (error) {
      toast.error("Error converting file");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-blue-900 mb-4">
            Convert Excel & Word to PDF
          </h1>
          <p className="text-lg text-gray-600">
            Simple, secure, and instant file conversion
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="p-6">
            <FileUploader 
              onFileSelect={handleConversion}
              isProcessing={isProcessing}
            />
          </Card>

          <PricingCard />
        </div>

        {convertedFile && (
          <div className="mt-8 text-center">
            <Button 
              onClick={() => window.open(convertedFile, '_blank')}
              className="bg-green-600 hover:bg-green-700"
            >
              Download Converted File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;