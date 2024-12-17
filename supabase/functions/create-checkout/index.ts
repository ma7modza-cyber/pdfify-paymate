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

    console.log('Creating PayPal order...');

    // Create PayPal order
    const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${paypalClientId}:${paypalSecretKey}`)}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: '1.99'
          },
          reference_id: conversionId
        }]
      })
    });

    const paypalOrder = await response.json();
    console.log('PayPal API response status:', response.status);
    console.log('PayPal order response:', paypalOrder);

    if (!response.ok) {
      console.error('PayPal API error:', paypalOrder);
      throw new Error(paypalOrder.message || 'Failed to create PayPal order');
    }

    // Update conversion record with PayPal order ID
    const { error: updateError } = await supabaseClient
      .from('conversions')
      .update({ payment_intent_id: paypalOrder.id })
      .eq('id', conversionId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Failed to update conversion record:', updateError);
      throw new Error('Failed to update conversion record');
    }

    // Return the PayPal approval URL
    const approvalUrl = paypalOrder.links.find((link: any) => link.rel === 'approve')?.href;
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