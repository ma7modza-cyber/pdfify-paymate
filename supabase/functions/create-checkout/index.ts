import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalOrderResponse {
  id: string;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

const getPayPalAccessToken = async (clientId: string, secretKey: string): Promise<string> => {
  console.log('Requesting PayPal access token...');
  
  const credentials = btoa(`${clientId}:${secretKey}`);
  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PayPal token error:', errorText);
    throw new Error(`PayPal authentication failed: ${errorText}`);
  }

  const data = await response.json() as PayPalTokenResponse;
  console.log('Successfully obtained PayPal access token');
  return data.access_token;
};

const createPayPalOrder = async (accessToken: string, conversionId: string, origin: string): Promise<string> => {
  console.log('Creating PayPal order...');
  
  const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
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
        return_url: `${origin}/?payment_success=true&conversion_id=${conversionId}`,
        cancel_url: `${origin}/?payment_cancelled=true`,
        user_action: 'PAY_NOW',
        brand_name: 'PDF Converter'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('PayPal order error:', errorData);
    throw new Error('Failed to create PayPal order');
  }

  const orderData = await response.json() as PayPalOrderResponse;
  const approvalUrl = orderData.links.find(link => link.rel === 'approve')?.href;
  
  if (!approvalUrl) {
    throw new Error('PayPal approval URL not found');
  }

  console.log('Successfully created PayPal order:', orderData.id);
  return approvalUrl;
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

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    
    if (!paypalClientId || !paypalSecretKey) {
      console.error('Missing PayPal credentials');
      throw new Error('PayPal credentials not configured');
    }

    const accessToken = await getPayPalAccessToken(paypalClientId, paypalSecretKey);
    const approvalUrl = await createPayPalOrder(accessToken, conversionId, req.headers.get('origin') || '');

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