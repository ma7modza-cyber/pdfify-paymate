import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useConversion = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [conversionStatus, setConversionStatus] = useState<string>('pending');
  const [convertedFilePath, setConvertedFilePath] = useState<string | null>(null);

  const handleConversion = async (file: File) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to continue");
        return;
      }

      // First check if bucket exists
      const { data: buckets } = await supabase
        .storage
        .listBuckets();

      const conversionsBucket = buckets?.find(b => b.name === 'conversions');
      
      if (!conversionsBucket) {
        console.log("Creating conversions bucket");
        // Create bucket with public access
        const { error: createBucketError } = await supabase
          .storage
          .createBucket('conversions', { 
            public: true, // Make bucket public
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

  return {
    isProcessing,
    conversionId,
    conversionStatus,
    convertedFilePath,
    handleConversion,
    handleDownload,
    setConversionStatus,
    setConvertedFilePath,
    setIsProcessing
  };
};