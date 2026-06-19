/**
 * Edge Function: award-monthly-bonus
 *
 * Awards monthly bonus stars to all active Pro and Elite subscribers.
 * Run this on a monthly schedule (e.g., 1st of each month at 00:00 UTC)
 * via OnSpace Cloud or an external cron service calling:
 *   POST /functions/v1/award-monthly-bonus
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Idempotent: each user can only receive the bonus once per calendar month.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TIER_STARS: Record<string, number> = {
  pro:   500,
  elite: 1500,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Determine current billing period (YYYY-MM)
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[award-monthly-bonus] Running for period: ${period}`);

    // Fetch all active Pro/Elite subscribers whose subscription hasn't expired
    const { data: subscribers, error: subErr } = await supabase
      .from('user_profiles')
      .select('id, subscription_tier, email, tiktok_username')
      .in('subscription_tier', ['pro', 'elite'])
      .or(`subscription_expires_at.is.null,subscription_expires_at.gt.${now.toISOString()}`);

    if (subErr) {
      console.error('[award-monthly-bonus] Failed to fetch subscribers:', subErr.message);
      return new Response(
        JSON.stringify({ error: subErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, awarded: 0, skipped: 0, period }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[award-monthly-bonus] Found ${subscribers.length} eligible subscribers`);

    let awarded = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process in batches of 50 to avoid timeouts
    const BATCH_SIZE = 50;
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (user: any) => {
        const tier = user.subscription_tier as string;
        const stars = TIER_STARS[tier] ?? 0;
        if (!stars) return;

        try {
          // Idempotency check — skip if already awarded this period
          const { data: existing } = await supabase
            .from('monthly_bonus_log')
            .select('id')
            .eq('user_id', user.id)
            .eq('period', period)
            .maybeSingle();

          if (existing) {
            skipped++;
            console.log(`[award-monthly-bonus] Skipped ${user.id} — already awarded for ${period}`);
            return;
          }

          // Fetch current stars
          const { data: profile, error: profileErr } = await supabase
            .from('user_profiles')
            .select('stars, total_stars_earned')
            .eq('id', user.id)
            .single();

          if (profileErr || !profile) {
            errors.push(`Profile fetch failed for ${user.id}: ${profileErr?.message}`);
            return;
          }

          const newStars = (profile.stars || 0) + stars;
          const newTotal = (profile.total_stars_earned || 0) + stars;

          // Award stars
          const { error: updateErr } = await supabase
            .from('user_profiles')
            .update({ stars: newStars, total_stars_earned: newTotal })
            .eq('id', user.id);

          if (updateErr) {
            errors.push(`Update failed for ${user.id}: ${updateErr.message}`);
            return;
          }

          // Record transaction
          const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
          await supabase.from('star_transactions').insert({
            user_id: user.id,
            type: 'earn',
            amount: stars,
            description: `${tierLabel} monthly bonus — ${period}`,
            category: 'subscription',
          });

          // Log bonus to prevent re-runs
          await supabase.from('monthly_bonus_log').insert({
            user_id: user.id,
            period,
            tier,
            stars_awarded: stars,
          });

          // Send notification
          await supabase.from('notifications').insert({
            user_id: user.id,
            title: `Monthly Bonus — +${stars.toLocaleString()} ★`,
            body: `Your ${tierLabel} plan monthly bonus of ${stars.toLocaleString()} stars has been credited to your account!`,
            type: 'subscription',
            is_read: false,
          });

          awarded++;
          console.log(`[award-monthly-bonus] Awarded ${stars} stars to ${user.id} (${tier})`);
        } catch (e: any) {
          errors.push(`Error processing ${user.id}: ${e.message}`);
        }
      }));
    }

    const result = {
      success: true,
      period,
      totalEligible: subscribers.length,
      awarded,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // cap error list
    };

    console.log('[award-monthly-bonus] Complete:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[award-monthly-bonus] Fatal error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
