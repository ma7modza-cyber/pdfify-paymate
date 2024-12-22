import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    console.log('Processing checkout for conversion:', conversionId);

    if (!conversionId) {
      throw new Error('Conversion ID is required');
    }

    // Get PayPal credentials
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    
    if (!paypalClientId || !paypalSecretKey) {
      console.error('Missing PayPal credentials');
      throw new Error('PayPal credentials not configured');
    }

    // Create base64 encoded credentials string
    const credentials = btoa(`${paypalClientId}:${paypalSecretKey}`);
    console.log('Requesting PayPal access token...');

    // Get PayPal access token using OAuth
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials'
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('PayPal token error:', errorText);
      throw new Error(`PayPal authentication failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully obtained PayPal access token');

    // Create PayPal order
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