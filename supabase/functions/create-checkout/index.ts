import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversionId, paymentMethod = 'stripe' } = await req.json();
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error('User not found');

    if (paymentMethod === 'paypal') {
      // PayPal checkout flow
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
      
      // Update conversion record with PayPal order ID
      await supabaseClient
        .from('conversions')
        .update({ payment_intent_id: paypalOrder.id })
        .eq('id', conversionId);

      return new Response(
        JSON.stringify({ 
          url: paypalOrder.links.find((link: any) => link.rel === 'approve').href,
          provider: 'paypal'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Stripe checkout flow
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
        apiVersion: '2023-10-16',
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'PDF Conversion',
            },
            unit_amount: 199,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get('origin')}/`,
        metadata: {
          conversionId,
        },
      });

      // Update conversion record with Stripe session ID
      await supabaseClient
        .from('conversions')
        .update({ payment_intent_id: session.id })
        .eq('id', conversionId);

      return new Response(
        JSON.stringify({ url: session.url, provider: 'stripe' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});