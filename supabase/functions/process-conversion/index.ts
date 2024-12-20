import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversionId } = await req.json();
    console.log('Processing conversion:', conversionId);

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Get conversion details
    const { data: conversion, error: conversionError } = await supabaseClient
      .from('conversions')
      .select('*')
      .eq('id', conversionId)
      .single();

    if (conversionError || !conversion) {
      throw new Error('Conversion not found');
    }

    if (conversion.payment_status !== 'paid') {
      throw new Error('Payment required before conversion');
    }

    // Download the original file
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('conversions')
      .download(conversion.original_file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download original file');
    }

    // TODO: Implement actual file conversion logic here
    // For now, we'll just simulate a conversion by creating a PDF file
    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF magic numbers
    const convertedFilePath = conversion.original_file_path.replace(/\.[^/.]+$/, ".pdf");

    // Upload the converted file
    const { error: uploadError } = await supabaseClient.storage
      .from('conversions')
      .upload(convertedFilePath, pdfContent, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Failed to upload converted file');
    }

    // Update conversion record
    const { error: updateError } = await supabaseClient
      .from('conversions')
      .update({
        converted_file_path: convertedFilePath,
        status: 'completed'
      })
      .eq('id', conversionId);

    if (updateError) {
      throw new Error('Failed to update conversion status');
    }

    return new Response(
      JSON.stringify({ 
        message: 'Conversion completed successfully',
        convertedFilePath 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Conversion error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});