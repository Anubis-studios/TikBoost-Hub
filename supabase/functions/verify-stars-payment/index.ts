import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError || !user) throw new Error("User not authenticated");

    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ success: false, status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Validate user owns this session
    const sessionUserId = session.metadata?.user_id;
    if (sessionUserId && sessionUserId !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    const starAmount = parseInt(session.metadata?.star_amount || "0");
    if (!starAmount) throw new Error("Invalid star amount in session metadata");

    // Check for duplicate fulfillment using payment_intent ID
    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

    if (!paymentIntentId) throw new Error("No payment intent found");

    // Check if already fulfilled — look for existing transaction with this description
    const { data: existing } = await supabaseAdmin
      .from("star_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("description", `Stars purchase: ${starAmount} stars (${paymentIntentId})`)
      .maybeSingle();

    if (existing) {
      // Already fulfilled — idempotent response
      return new Response(JSON.stringify({ success: true, already_fulfilled: true, star_amount: starAmount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get current profile
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("stars, total_stars_earned")
      .eq("id", user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    const newStars = (profile.stars || 0) + starAmount;
    const newTotal = (profile.total_stars_earned || 0) + starAmount;

    // Award stars
    await supabaseAdmin.from("user_profiles").update({
      stars: newStars,
      total_stars_earned: newTotal,
    }).eq("id", user.id);

    // Log transaction with payment_intent ID to prevent duplicates
    await supabaseAdmin.from("star_transactions").insert({
      user_id: user.id,
      type: "earn",
      amount: starAmount,
      description: `Stars purchase: ${starAmount} stars (${paymentIntentId})`,
      category: "purchase",
    });

    // Notification
    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Stars Purchased!",
      body: `${starAmount.toLocaleString()} stars have been added to your account. Happy boosting!`,
      type: "purchase",
      is_read: false,
    });

    console.log(`Stars granted: ${starAmount} to user ${user.id}`);

    return new Response(JSON.stringify({ success: true, star_amount: starAmount, new_total: newStars }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("verify-stars-payment error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
