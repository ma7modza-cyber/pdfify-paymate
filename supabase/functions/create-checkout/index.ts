import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    const { conversionId } = await req.json();
    console.log('Processing checkout for conversion:', conversionId);

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    // Get auth token from request header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    const token = authHeader.replace('Bearer ', '');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Verify user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('User not found');
    }

    // Get PayPal credentials
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    
    if (!paypalClientId || !paypalSecretKey) {
      throw new Error('PayPal credentials not configured');
    }

    // Get PayPal access token with proper credentials encoding
    const credentials = `${paypalClientId}:${paypalSecretKey}`;
    const base64Credentials = btoa(credentials);
    
    console.log('Requesting PayPal access token...');
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('PayPal token error:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        headers: Object.fromEntries(tokenResponse.headers),
        body: errorBody
      });
      throw new Error(`PayPal authentication failed: ${tokenResponse.status} - ${errorBody}`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('Invalid PayPal token response:', tokenData);
      throw new Error('Invalid PayPal token response');
    }

    console.log('Successfully obtained PayPal access token');

    // Create PayPal order with the valid token
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
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
            value: '1.99'
          },
          description: 'PDF Conversion Service',
          reference_id: conversionId
        }],
        application_context: {
          return_url: `${req.headers.get('origin')}/success`,
          cancel_url: `${req.headers.get('origin')}/cancel`,
          user_action: 'PAY_NOW',
          brand_name: 'PDF Converter'
        }
      })
    });

    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok) {
      console.error('PayPal order error:', orderData);
      throw new Error(`Failed to create PayPal order: ${orderResponse.status} - ${JSON.stringify(orderData)}`);
    }

    // Update conversion record with PayPal order ID
    const { error: updateError } = await supabaseClient
      .from('conversions')
      .update({ payment_intent_id: orderData.id })
      .eq('id', conversionId)
      .eq('user_id', user.id);

    if (updateError) {
      throw new Error('Failed to update conversion record');
    }

    // Return the PayPal approval URL
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