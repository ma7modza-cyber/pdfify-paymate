import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FileUploader from '@/components/FileUploader';
import PricingCard from '@/components/PricingCard';
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [conversionStatus, setConversionStatus] = useState<string>('pending');
  const [convertedFilePath, setConvertedFilePath] = useState<string | null>(null);
  const navigate = useNavigate();

  // Poll for conversion status
  useEffect(() => {
    if (!conversionId) return;

    const checkStatus = async () => {
      const { data: conversion, error } = await supabase
        .from('conversions')
        .select('*')
        .eq('id', conversionId)
        .single();

      if (error) {
        console.error('Error checking conversion status:', error);
        return;
      }

      if (conversion) {
        setConversionStatus(conversion.status);
        setConvertedFilePath(conversion.converted_file_path);
        
        if (conversion.status === 'completed') {
          setIsProcessing(false);
          toast.success('Your file has been converted successfully!');
        } else if (conversion.status === 'error') {
          setIsProcessing(false);
          toast.error('Conversion failed. Please try again.');
        }
      }
    };

    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [conversionId]);

  const handleConversion = async (file: File) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      // Create bucket if it doesn't exist
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();

      const conversionsBucket = buckets?.find(b => b.name === 'conversions');
      
      if (!conversionsBucket) {
        console.log("Creating conversions bucket");
        const { error: createBucketError } = await supabase
          .storage
          .createBucket('conversions', {
            public: false,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: [
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]
          });

        if (createBucketError) {
          console.error('Error creating bucket:', createBucketError);
          toast.error("Failed to initialize storage");
          setIsProcessing(false);
          return;
        }
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('conversions')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Create conversion record
      const { data: conversion, error: conversionError } = await supabase
        .from('conversions')
        .insert({
          user_id: session.user.id,
          original_filename: file.name,
          original_file_path: filePath,
        })
        .select()
        .single();

      if (conversionError) {
        throw conversionError;
      }

      setConversionId(conversion.id);
      toast.success("File uploaded successfully!");
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error("Error uploading file");
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!convertedFilePath) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('conversions')
        .download(convertedFilePath);

      if (error) {
        throw error;
      }

      // Create a download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = convertedFilePath.split('/').pop() || 'converted.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Download started!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
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
            {conversionStatus === 'completed' && convertedFilePath && (
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={handleDownload}
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
            onPaymentInitiated={() => setIsProcessing(true)}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;