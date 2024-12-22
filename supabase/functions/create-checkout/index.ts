import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { conversionId } = await req.json();
    console.log('Processing checkout for conversion:', conversionId);

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    // Get PayPal credentials from environment variables
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    
    if (!paypalClientId || !paypalSecretKey) {
      throw new Error('PayPal credentials not configured');
    }

    // Get PayPal access token
    const credentialsString = `${paypalClientId}:${paypalSecretKey}`;
    const encodedCredentials = base64Encode(new TextEncoder().encode(credentialsString));
    
    const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`PayPal authentication failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully obtained PayPal access token');

    // Create PayPal order
    const orderResponse = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'PayPal-Request-Id': crypto.randomUUID(),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: '1.99'
          },
          description: 'PDF Conversion Service',
          reference_id: conversionId
        }],
        application_context: {
          return_url: `${req.headers.get('origin')}/?payment_success=true&conversion_id=${conversionId}`,
          cancel_url: `${req.headers.get('origin')}/?payment_cancelled=true`,
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

    const approvalUrl = orderData.links.find((link: any) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new Error('PayPal approval URL not found');
    }

    console.log('Successfully created PayPal order:', orderData.id);
    
    return new Response(
      JSON.stringify({ url: approvalUrl }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
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