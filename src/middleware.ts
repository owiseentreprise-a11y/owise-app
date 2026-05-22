import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchit le token — ne pas supprimer cette ligne
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes publiques autorisées sans auth
  const isPublic = pathname.startsWith('/login')

  // Protection des routes privées
  if (!isPublic && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protection par rôle sur les exports (pas couverts par les layouts)
  const role = user?.app_metadata?.role
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname.startsWith('/chauffeur') && role !== 'chauffeur') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protection cron : vérifiée dans la route elle-même (CRON_SECRET)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
