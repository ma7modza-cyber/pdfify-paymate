import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageContainer from "@/components/layout/PageContainer";
import ConversionHeader from "@/components/conversion/ConversionHeader";
import ConversionContainer from "@/components/conversion/ConversionContainer";
import { useConversion } from "@/hooks/useConversion";

const Index = () => {
  const {
    isProcessing,
    conversionId,
    conversionStatus,
    convertedFilePath,
    handleConversion,
    handleDownload,
    setConversionStatus,
    setConvertedFilePath,
    setIsProcessing
  } = useConversion();

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
        }
      }
    };

    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [conversionId]);

  return (
    <PageContainer>
      <ConversionHeader />
      <ConversionContainer
        isProcessing={isProcessing}
        conversionId={conversionId}
        conversionStatus={conversionStatus}
        convertedFilePath={convertedFilePath}
        onFileSelect={handleConversion}
        onDownload={handleDownload}
      />
    </PageContainer>
  );
};

export default Index;