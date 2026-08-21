import { createClient } from '@supabase/supabase-js'

/* The browser's Supabase client. Auth and the owner's own room list, nothing
   else - every privileged read goes through api/, under the service role.

   The publishable key is meant to ship. It grants exactly what RLS allows,
   which for public.rooms is "select, update and delete the rows you own" and
   no insert at all. */

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /* The mechanism behind the magic link: on the page the redirect lands
         on, supabase-js reads the code out of the URL and exchanges it for a
         session. It is the default, and it is stated because it is the whole
         trick - and because it only fires on that one page load, which is why
         vercel.json's SPA rewrite matters to auth as much as to the API. */
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
)
