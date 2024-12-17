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
    // Parse request body
    const { conversionId } = await req.json();
    console.log('Processing checkout for conversion:', conversionId);

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    // Get auth token from request header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
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
    console.log('User verification:', user ? 'successful' : 'failed');
    
    if (userError || !user) {
      console.error('User verification failed:', userError);
      throw new Error('User not found');
    }

    // Get PayPal credentials
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');

    if (!paypalClientId || !paypalSecretKey) {
      console.error('PayPal credentials missing');
      throw new Error('PayPal credentials not configured');
    }

    console.log('Getting PayPal access token...');

    // Get PayPal access token
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${btoa(`${paypalClientId}:${paypalSecretKey}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('PayPal token error response:', tokenError);
      throw new Error('Failed to get PayPal access token');
    }

    const tokenData = await tokenResponse.json();
    console.log('PayPal access token obtained successfully');

    if (!tokenData.access_token) {
      console.error('No access token in PayPal response:', tokenData);
      throw new Error('Invalid PayPal token response');
    }

    // Create PayPal order
    console.log('Creating PayPal order...');
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: '1.99'
          },
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
    console.log('PayPal order response:', orderData);

    if (!orderResponse.ok) {
      console.error('PayPal API error:', orderData);
      throw new Error(orderData.message || 'Failed to create PayPal order');
    }

    // Update conversion record with PayPal order ID
    const { error: updateError } = await supabaseClient
      .from('conversions')
      .update({ payment_intent_id: orderData.id })
      .eq('id', conversionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to update conversion record:', updateError);
      throw new Error('Failed to update conversion record');
    }

    // Return the PayPal approval URL
    const approvalUrl = orderData.links.find((link: any) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new Error('PayPal approval URL not found');
    }

    return new Response(
      JSON.stringify({ url: approvalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-checkout function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    );
  }
});