import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify admin auth
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the requesting user is an admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { title, body, type, target_mode, target_user_id, target_username } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'Title and body are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve target user IDs
    let userIds: string[] = [];

    if (target_mode === 'single') {
      if (target_user_id) {
        userIds = [target_user_id];
      } else if (target_username) {
        const { data } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .ilike('tiktok_username', target_username.trim())
          .limit(1);
        userIds = data?.map((u: any) => u.id) || [];
      }
    } else if (target_mode === 'vip') {
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('is_vip', true);
      userIds = data?.map((u: any) => u.id) || [];
    } else {
      // All users — fetch in batches
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .range(from, from + batchSize - 1);
        if (error || !data || data.length === 0) break;
        userIds.push(...data.map((u: any) => u.id));
        if (data.length < batchSize) break;
        from += batchSize;
      }
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found', count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert notifications in batches of 500
    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const rows = batch.map((uid) => ({
        user_id: uid,
        title: title.trim(),
        body: body.trim(),
        type: type || 'general',
        is_read: false,
      }));

      const { error: insertError, count } = await supabaseAdmin
        .from('notifications')
        .insert(rows)
        .select('id', { count: 'exact', head: true });

      if (insertError) {
        console.error(`Batch ${i / batchSize} error:`, insertError.message);
      } else {
        inserted += batch.length;
      }
    }

    // Log the admin action
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: user.id,
      action: 'broadcast_notification',
      details: {
        title: title.trim(),
        type: type || 'general',
        target_mode,
        recipients_resolved: userIds.length,
        recipients_inserted: inserted,
      },
    });

    console.log(`Broadcast complete: ${inserted}/${userIds.length} notifications inserted`);

    return new Response(
      JSON.stringify({ success: true, total: userIds.length, inserted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Admin broadcast error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
