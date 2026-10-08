// Google Calendar sync edge function

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ...params } = await req.json();

    if (action === 'create-event') {
      // Get user's Google Calendar token from secure table
      const { data: tokenRow } = await supabase
        .from('google_calendar_tokens')
        .select('token')
        .eq('user_id', user.id)
        .single();

      if (!tokenRow?.token) {
        return new Response(JSON.stringify({ error: 'Google Calendar not connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenData = tokenRow.token as any;
      let accessToken = tokenData.access_token;

      // Check if token expired, refresh if needed
      if (tokenData.expiry && new Date(tokenData.expiry) < new Date()) {
        if (!tokenData.refresh_token) {
          return new Response(JSON.stringify({ error: 'Token expired, please reconnect Google Calendar' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

        if (!clientId || !clientSecret) {
          return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokenData.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshRes.ok) {
          return new Response(JSON.stringify({ error: 'Failed to refresh Google token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;

        // Update stored token
        await supabase
          .from('google_calendar_tokens')
          .update({
            token: {
              ...tokenData,
              access_token: accessToken,
              expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      // Create calendar event
      const { title, description, startTime, endTime, attendees } = params;
      
      const event: any = {
        summary: title,
        description: description || '',
        start: { dateTime: startTime, timeZone: 'UTC' },
        end: { dateTime: endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
      };

      if (attendees?.length) {
        event.attendees = attendees.map((email: string) => ({ email }));
      }

      const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!calRes.ok) {
        const errBody = await calRes.text();
        return new Response(JSON.stringify({ error: `Calendar API error: ${errBody}` }), {
          status: calRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const calEvent = await calRes.json();
      return new Response(JSON.stringify({ eventId: calEvent.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'update-event') {
      const { eventId, title, description, startTime, endTime } = params;
      
      const { data: tokenRow } = await supabase
        .from('google_calendar_tokens')
        .select('token')
        .eq('user_id', user.id)
        .single();

      if (!tokenRow?.token) {
        return new Response(JSON.stringify({ error: 'Google Calendar not connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = (tokenRow.token as any).access_token;

      const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          description,
          start: { dateTime: startTime, timeZone: 'UTC' },
          end: { dateTime: endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
        }),
      });

      if (!calRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to update event' }), {
          status: calRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'delete-event') {
      const { eventId } = params;

      const { data: tokenRow } = await supabase
        .from('google_calendar_tokens')
        .select('token')
        .eq('user_id', user.id)
        .single();

      if (!tokenRow?.token) {
        return new Response(JSON.stringify({ error: 'Not connected' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const accessToken = (tokenRow.token as any).access_token;

      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
