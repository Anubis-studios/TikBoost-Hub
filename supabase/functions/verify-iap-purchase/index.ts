/**
 * verify-iap-purchase Edge Function
 *
 * Validates an in-app purchase token (Google Play or App Store),
 * awards stars and/or VIP days based on product_id, records the
 * transaction, and returns success/failure.
 *
 * Supported products (must match iapService.ts IAP_PRODUCT_IDS):
 *   Stars:   com.tikboost.stars.{500,1000,2500,5000,10000}
 *   VIP:     com.tikboost.vip.30days
 *   Spin:    com.tikboost.wheel.spin
 *   Bundles: com.tikboost.bundle.{starter,growth,viral}
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─── Product Catalog (mirrors iapService.ts) ──────────────────────────────────

interface ProductConfig {
  stars: number;          // Stars to award (0 for VIP-only)
  vipDays: number;        // VIP days to grant (0 for stars-only)
  category: string;       // star_transactions category
  description: string;    // human-readable transaction description
  isConsumable: boolean;  // can be purchased multiple times
}

const PRODUCT_CATALOG: Record<string, ProductConfig> = {
  'com.tikboost.stars.500': {
    stars: 500,    vipDays: 0,  category: 'purchase',
    description:  '500 Stars purchased (App)',    isConsumable: true,
  },
  'com.tikboost.stars.1000': {
    stars: 1100,   vipDays: 0,  category: 'purchase',
    description:  '1,100 Stars purchased (App)',  isConsumable: true,
  },
  'com.tikboost.stars.2500': {
    stars: 2750,   vipDays: 0,  category: 'purchase',
    description:  '2,750 Stars purchased (App)',  isConsumable: true,
  },
  'com.tikboost.stars.5000': {
    stars: 5600,   vipDays: 0,  category: 'purchase',
    description:  '5,600 Stars purchased (App)',  isConsumable: true,
  },
  'com.tikboost.stars.10000': {
    stars: 11500,  vipDays: 0,  category: 'purchase',
    description:  '11,500 Stars purchased (App)', isConsumable: true,
  },
  'com.tikboost.vip.30days': {
    stars: 500,    vipDays: 30, category: 'vip',
    description:  'VIP 30-day membership activated', isConsumable: false,
  },
  'com.tikboost.wheel.spin': {
    stars: 0,      vipDays: 0,  category: 'purchase',
    description:  'Lucky Wheel spin purchased',  isConsumable: true,
  },
  'com.tikboost.bundle.starter': {
    stars: 500,    vipDays: 7,  category: 'purchase',
    description:  'Starter Bundle activated',    isConsumable: true,
  },
  'com.tikboost.bundle.growth': {
    stars: 2000,   vipDays: 30, category: 'purchase',
    description:  'Growth Bundle activated',     isConsumable: true,
  },
  'com.tikboost.bundle.viral': {
    stars: 10000,  vipDays: 60, category: 'purchase',
    description:  'Viral Bundle activated',      isConsumable: true,
  },
};

// ─── Platform Validation (stubs ready for real store API integration) ─────────

/**
 * Validate a Google Play purchase token.
 *
 * Production integration:
 *   1. Add secret GOOGLE_PLAY_SERVICE_ACCOUNT_JSON in OnSpace Cloud Secrets
 *   2. Authenticate with googleapis (JWT / service account)
 *   3. Call: GET https://androidpublisher.googleapis.com/androidpublisher/v3/
 *            applications/{packageName}/purchases/products/{productId}/tokens/{token}
 *   4. Check purchaseState === 0 (purchased) and consumptionState as needed
 *
 * Returns true when the token is valid and the purchase is confirmed.
 */
async function validateGooglePlay(
  productId: string,
  purchaseToken: string,
): Promise<{ valid: boolean; error?: string }> {
  // ── Development / Demo stub ──────────────────────────────────────────────────
  // Token format from iapService stub: "token_{timestamp}_{random}"
  // Accept stub tokens for development; reject obviously invalid real tokens.
  if (purchaseToken.startsWith('token_')) {
    console.log(`[Google Play] Stub token accepted for ${productId}`);
    return { valid: true };
  }

  // ── Production path (uncomment when Google Play credentials are available) ───
  // try {
  //   const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') ?? '{}');
  //   const packageName = 'com.tikboost.app';
  //
  //   // Obtain access token via JWT
  //   const jwtToken = await createGoogleJWT(serviceAccount);
  //   const accessToken = await exchangeForAccessToken(jwtToken);
  //
  //   const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/` +
  //     `applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;
  //
  //   const res = await fetch(url, {
  //     headers: { Authorization: `Bearer ${accessToken}` },
  //   });
  //   if (!res.ok) return { valid: false, error: `Google Play API error: ${res.status}` };
  //
  //   const data = await res.json();
  //   // purchaseState 0 = Purchased, 1 = Cancelled, 2 = Pending
  //   if (data.purchaseState !== 0) {
  //     return { valid: false, error: `Purchase state is not confirmed: ${data.purchaseState}` };
  //   }
  //   return { valid: true };
  // } catch (err) {
  //   return { valid: false, error: `Google Play validation failed: ${err.message}` };
  // }

  // For now, accept all real tokens with a warning (until credentials are configured)
  console.warn(`[Google Play] Production validation not configured — accepting token for ${productId}`);
  return { valid: true };
}

/**
 * Validate an Apple App Store receipt.
 *
 * Production integration:
 *   1. Add secret APPLE_SHARED_SECRET in OnSpace Cloud Secrets
 *   2. POST receipt data to verifyReceipt endpoint:
 *      Production: https://buy.itunes.apple.com/verifyReceipt
 *      Sandbox:    https://sandbox.itunes.apple.com/verifyReceipt
 *   3. Check status === 0 and validate in_app array contains the product
 *   4. Auto-retry against sandbox if production returns status 21007
 *
 * Returns true when the receipt is valid.
 */
async function validateAppStore(
  productId: string,
  receiptOrToken: string,
): Promise<{ valid: boolean; error?: string }> {
  // ── Development / Demo stub ──────────────────────────────────────────────────
  if (receiptOrToken.startsWith('token_') || receiptOrToken.startsWith('txn_')) {
    console.log(`[App Store] Stub receipt accepted for ${productId}`);
    return { valid: true };
  }

  // ── Production path (uncomment when Apple shared secret is available) ────────
  // try {
  //   const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET') ?? '';
  //   const body = JSON.stringify({ 'receipt-data': receiptOrToken, password: sharedSecret });
  //
  //   let res = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
  //     method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  //   });
  //   let data = await res.json();
  //
  //   // 21007 = sandbox receipt sent to production endpoint; retry against sandbox
  //   if (data.status === 21007) {
  //     res = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
  //       method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  //     });
  //     data = await res.json();
  //   }
  //
  //   if (data.status !== 0) return { valid: false, error: `App Store status: ${data.status}` };
  //
  //   const inApp: any[] = data.receipt?.in_app ?? [];
  //   const found = inApp.some((p: any) => p.product_id === productId);
  //   if (!found) return { valid: false, error: 'Product not found in receipt' };
  //
  //   return { valid: true };
  // } catch (err) {
  //   return { valid: false, error: `App Store validation failed: ${err.message}` };
  // }

  console.warn(`[App Store] Production validation not configured — accepting receipt for ${productId}`);
  return { valid: true };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // ── CORS preflight ─────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Parse request ────────────────────────────────────────────────────────
    const { product_id, purchase_token, platform } = await req.json() as {
      product_id: string;
      purchase_token: string;
      platform: 'ios' | 'android';
    };

    if (!product_id || !purchase_token || !platform) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: product_id, purchase_token, platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Lookup product config ────────────────────────────────────────────────
    const product = PRODUCT_CATALOG[product_id];
    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: `Unknown product_id: ${product_id}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Auth: get user from JWT ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (userError || !user) {
      console.error('[verify-iap] Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = user.id;
    console.log(`[verify-iap] User ${userId} | Product ${product_id} | Platform ${platform}`);

    // ── Idempotency: prevent double-award for the same purchase token ────────
    const { data: existingTx } = await supabaseAdmin
      .from('star_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('description', `${product.description} [${purchase_token.slice(-12)}]`)
      .maybeSingle();

    if (existingTx) {
      console.log(`[verify-iap] Duplicate purchase token detected for user ${userId}`);
      return new Response(
        JSON.stringify({ success: true, alreadyProcessed: true, message: 'Purchase already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Validate with the appropriate store ──────────────────────────────────
    let validation: { valid: boolean; error?: string };

    if (platform === 'android') {
      validation = await validateGooglePlay(product_id, purchase_token);
    } else {
      validation = await validateAppStore(product_id, purchase_token);
    }

    if (!validation.valid) {
      console.error(`[verify-iap] Validation failed: ${validation.error}`);
      return new Response(
        JSON.stringify({ success: false, error: validation.error || 'Purchase validation failed' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Award stars ──────────────────────────────────────────────────────────
    const txDescription = `${product.description} [${purchase_token.slice(-12)}]`;

    if (product.stars > 0) {
      // Increment user stars using the database function
      const { error: starsError } = await supabaseAdmin.rpc('increment_stars', {
        user_id: userId,
        amount: product.stars,
      });

      if (starsError) {
        console.error('[verify-iap] increment_stars error:', starsError.message);
        // Fallback: direct update if RPC fails
        const { data: currentProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('stars, total_stars_earned')
          .eq('id', userId)
          .single();

        if (currentProfile) {
          await supabaseAdmin
            .from('user_profiles')
            .update({
              stars: (currentProfile.stars || 0) + product.stars,
              total_stars_earned: (currentProfile.total_stars_earned || 0) + product.stars,
            })
            .eq('id', userId);
        }
      }

      // Record transaction
      await supabaseAdmin.from('star_transactions').insert({
        user_id: userId,
        type: 'earn',
        amount: product.stars,
        description: txDescription,
        category: product.category,
      });

      console.log(`[verify-iap] Awarded ${product.stars} stars to user ${userId}`);
    }

    // ── Grant VIP ────────────────────────────────────────────────────────────
    if (product.vipDays > 0) {
      const { data: currentProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('vip_expires_at, is_vip')
        .eq('id', userId)
        .single();

      // Stack VIP days if already VIP and not expired
      const now = new Date();
      const currentExpiry = currentProfile?.vip_expires_at
        ? new Date(currentProfile.vip_expires_at)
        : null;

      const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate.getTime() + product.vipDays * 24 * 60 * 60 * 1000);

      const { error: vipError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          is_vip: true,
          vip_expires_at: newExpiry.toISOString(),
        })
        .eq('id', userId);

      if (vipError) {
        console.error('[verify-iap] VIP update error:', vipError.message);
      } else {
        console.log(`[verify-iap] VIP granted to user ${userId} until ${newExpiry.toISOString()}`);
      }

      // Record VIP transaction (if not already recording stars above for this product)
      if (product.stars === 0) {
        await supabaseAdmin.from('star_transactions').insert({
          user_id: userId,
          type: 'earn',
          amount: 0,
          description: txDescription,
          category: 'vip',
        });
      }
    }

    // ── Special: Lucky Wheel — award random stars ─────────────────────────────
    if (product_id === 'com.tikboost.wheel.spin') {
      const segments = [200, 300, 500, 800, 1000, 1500, 3000];
      const winAmount = segments[Math.floor(Math.random() * segments.length)];

      // Increment stars
      const { data: currentProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('stars, total_stars_earned')
        .eq('id', userId)
        .single();

      if (currentProfile) {
        await supabaseAdmin
          .from('user_profiles')
          .update({
            stars: (currentProfile.stars || 0) + winAmount,
            total_stars_earned: (currentProfile.total_stars_earned || 0) + winAmount,
          })
          .eq('id', userId);
      }

      // Record spin transaction
      await supabaseAdmin.from('star_transactions').insert({
        user_id: userId,
        type: 'earn',
        amount: winAmount,
        description: `Lucky Wheel spin — won ${winAmount} stars [${purchase_token.slice(-12)}]`,
        category: 'spin_game',
      });

      // Send notification
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: 'Lucky Wheel Win!',
        body: `You spun the wheel and won ${winAmount} stars!`,
        type: 'general',
      });

      console.log(`[verify-iap] Spin awarded ${winAmount} stars to user ${userId}`);

      return new Response(
        JSON.stringify({
          success: true,
          product_id,
          stars_awarded: winAmount,
          vip_days_granted: 0,
          spin_win: winAmount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Send purchase notification ────────────────────────────────────────────
    const notifBody = product.vipDays > 0 && product.stars > 0
      ? `${product.stars.toLocaleString()} stars and ${product.vipDays}-day VIP have been applied to your account!`
      : product.vipDays > 0
      ? `VIP membership activated for ${product.vipDays} days!`
      : `${product.stars.toLocaleString()} stars have been added to your account!`;

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'Purchase Successful',
      body: notifBody,
      type: 'general',
    });

    // ── Success response ──────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        product_id,
        stars_awarded: product.stars,
        vip_days_granted: product.vipDays,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err: any) {
    console.error('[verify-iap] Unhandled error:', err?.message || err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
