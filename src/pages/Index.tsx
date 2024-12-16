import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FileUploader from '@/components/FileUploader';
import PricingCard from '@/components/PricingCard';
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversionId, setConversionId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleConversion = async (file: File) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-end mb-8">
          <Button variant="outline" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
        
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