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

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ success: false, status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Confirm user_id matches session metadata
    const sessionUserId = session.metadata?.user_id;
    if (sessionUserId && sessionUserId !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    // Check if VIP already activated for this session to avoid duplicate grants
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("is_vip, vip_expires_at, stars, total_stars_earned")
      .eq("id", user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    // Only activate if not already VIP (or VIP expired)
    const now = new Date();
    const alreadyVIP = profile.is_vip && profile.vip_expires_at && new Date(profile.vip_expires_at) > now;

    if (!alreadyVIP) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const newStars = (profile.stars || 0) + 500;
      const newTotal = (profile.total_stars_earned || 0) + 500;

      await supabaseAdmin.from("user_profiles").update({
        is_vip: true,
        vip_expires_at: expiresAt.toISOString(),
        stars: newStars,
        total_stars_earned: newTotal,
      }).eq("id", user.id);

      await supabaseAdmin.from("star_transactions").insert({
        user_id: user.id,
        type: "earn",
        amount: 500,
        description: "VIP activation bonus",
        category: "vip",
      });

      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        title: "VIP Activated!",
        body: "Payment confirmed! You now have VIP status for 30 days and received 500 bonus stars.",
        type: "vip",
        is_read: false,
      });

      console.log(`VIP activated for user ${user.id}`);
    }

    return new Response(JSON.stringify({ success: true, already_active: alreadyVIP }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("verify-vip-payment error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
