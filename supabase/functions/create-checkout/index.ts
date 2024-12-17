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
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Verify user
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error('User not found');

    // Create PayPal order
    const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(Deno.env.get('PAYPAL_CLIENT_ID') + ':' + Deno.env.get('PAYPAL_SECRET_KEY'))}`,
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
    console.log('PayPal order created:', paypalOrder);

    if (paypalOrder.error) {
      throw new Error(paypalOrder.error.message);
    }

    // Update conversion record with PayPal order ID
    const { error: updateError } = await supabaseClient
      .from('conversions')
      .update({ payment_intent_id: paypalOrder.id })
      .eq('id', conversionId);

    if (updateError) {
      throw new Error('Failed to update conversion record');
    }

    // Return the PayPal approval URL
    const approvalUrl = paypalOrder.links.find((link: any) => link.rel === 'approve').href;
    return new Response(
      JSON.stringify({ url: approvalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});