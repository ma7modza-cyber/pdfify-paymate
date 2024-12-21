import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYPAL_API_URL = 'https://api-m.paypal.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversionId } = await req.json();
    console.log('Processing checkout for conversion:', conversionId);

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('User error:', userError);
      throw new Error('User not found');
    }

    console.log('Found user:', user.id);

    const { data: conversion, error: conversionError } = await supabaseAdmin
      .from('conversions')
      .select('*')
      .eq('id', conversionId)
      .eq('user_id', user.id)
      .single();

    if (conversionError) {
      console.error('Conversion error:', conversionError);
      throw new Error('Conversion not found');
    }

    if (!conversion) {
      console.error('No conversion found for ID:', conversionId, 'and user:', user.id);
      throw new Error('Conversion not found');
    }

    console.log('Found conversion:', conversion.id);

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    
    if (!paypalClientId || !paypalSecretKey) {
      console.error('PayPal credentials missing');
      throw new Error('PayPal credentials not configured');
    }

    // Log PayPal credentials length for debugging (don't log actual credentials)
    console.log('PayPal Client ID length:', paypalClientId.length);
    console.log('PayPal Secret Key length:', paypalSecretKey.length);

    const credentials = btoa(`${paypalClientId}:${paypalSecretKey}`);
    
    console.log('Requesting PayPal access token...');
    
    const tokenResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('PayPal token error response:', tokenError);
      throw new Error(`PayPal authentication failed: ${tokenError}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully obtained PayPal access token');

    const origin = req.headers.get('origin') || 'http://localhost:8080';
    
    const orderResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'PayPal-Request-Id': crypto.randomUUID(),
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: conversion.amount.toString()
          },
          description: 'PDF Conversion Service',
          reference_id: conversionId
        }],
        application_context: {
          return_url: `${origin}/?payment_success=true&conversion_id=${conversionId}`,
          cancel_url: `${origin}/?payment_cancelled=true`,
          user_action: 'PAY_NOW',
          brand_name: 'PDF Converter'
        }
      })
    });

    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      console.error('PayPal order error:', orderData);
      throw new Error('Failed to create PayPal order');
    }

    const { error: updateError } = await supabaseAdmin
      .from('conversions')
      .update({ 
        payment_intent_id: orderData.id,
        payment_status: 'pending'
      })
      .eq('id', conversionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to update conversion record');
    }

    const approvalUrl = orderData.links.find((link: any) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new Error('PayPal approval URL not found');
    }

    console.log('Successfully created PayPal order:', orderData.id);
    
    return new Response(
      JSON.stringify({ url: approvalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});