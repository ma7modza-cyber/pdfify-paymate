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
  console.log('Starting PayPal authentication process...');
  
  const auth = btoa(`${clientId}:${secretKey}`);
  console.log('Using PayPal sandbox environment');
  
  try {
    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    const responseText = await response.text();
    console.log('PayPal auth response status:', response.status);
    console.log('PayPal auth response:', responseText);

    if (!response.ok) {
      throw new Error(`PayPal authentication failed: ${responseText}`);
    }

    const data = JSON.parse(responseText) as PayPalTokenResponse;
    console.log('Successfully obtained PayPal access token');
    return data.access_token;
  } catch (error) {
    console.error('PayPal authentication error:', error);
    throw error;
  }
};

const createPayPalOrder = async (accessToken: string, conversionId: string, origin: string): Promise<string> => {
  console.log('Creating PayPal order...');
  
  try {
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

    const responseText = await response.text();
    console.log('PayPal order creation response:', responseText);

    if (!response.ok) {
      throw new Error(`Failed to create PayPal order: ${responseText}`);
    }

    const orderData = JSON.parse(responseText) as PayPalOrderResponse;
    const approvalUrl = orderData.links.find(link => link.rel === 'approve')?.href;
    
    if (!approvalUrl) {
      throw new Error('PayPal approval URL not found in response');
    }

    console.log('Successfully created PayPal order:', orderData.id);
    return approvalUrl;
  } catch (error) {
    console.error('PayPal order creation error:', error);
    throw error;
  }
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

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecretKey = Deno.env.get('PAYPAL_SECRET_KEY');
    
    if (!paypalClientId || !paypalSecretKey) {
      console.error('Missing PayPal credentials');
      throw new Error('PayPal credentials not configured');
    }

    console.log('PayPal Client ID length:', paypalClientId.length);
    console.log('PayPal Secret Key length:', paypalSecretKey.length);

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