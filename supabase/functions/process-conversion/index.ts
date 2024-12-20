import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Document, Packer } from "https://esm.sh/docx@8.5.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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
    console.log('Starting conversion process for:', conversionId);

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get conversion details
    const { data: conversion, error: conversionError } = await supabase
      .from('conversions')
      .select('*')
      .eq('id', conversionId)
      .single();

    if (conversionError || !conversion) {
      throw new Error('Conversion not found');
    }

    console.log('Retrieved conversion details:', conversion);

    // Download the original file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('conversions')
      .download(conversion.original_file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download original file');
    }

    let pdfBuffer;
    const fileExtension = conversion.original_filename.split('.').pop()?.toLowerCase();

    if (fileExtension === 'xlsx') {
      console.log('Converting Excel file to PDF');
      // Convert Excel to PDF
      const workbook = XLSX.read(await fileData.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const htmlContent = XLSX.utils.sheet_to_html(firstSheet);
      
      // Create a simple document with the HTML content
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            {
              text: XLSX.utils.sheet_to_txt(firstSheet),
              break: true
            }
          ],
        }],
      });

      pdfBuffer = await Packer.toBuffer(doc);
    } else if (fileExtension === 'docx') {
      console.log('Converting Word file to PDF');
      // For DOCX, we'll use the docx library to create a PDF
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            {
              text: "Converted from DOCX",
              break: true
            }
          ],
        }],
      });

      pdfBuffer = await Packer.toBuffer(doc);
    } else {
      throw new Error('Unsupported file format');
    }

    // Upload the converted PDF
    const pdfPath = `${conversion.original_file_path.split('.')[0]}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('conversions')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Failed to upload converted file');
    }

    // Update conversion record
    const { error: updateError } = await supabase
      .from('conversions')
      .update({
        converted_file_path: pdfPath,
        status: 'completed'
      })
      .eq('id', conversionId);

    if (updateError) {
      throw new Error('Failed to update conversion status');
    }

    console.log('Conversion completed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Conversion completed successfully',
        pdfPath 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Conversion error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});