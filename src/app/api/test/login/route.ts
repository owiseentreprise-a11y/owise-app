import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// This route is ONLY available in development — used by E2E tests
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? 'Auth failed' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, userId: data.user.id })
}
