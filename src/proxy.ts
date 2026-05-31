import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const protectedPrefixes = ['/admin', '/chauffeur', '/espace-client']
  const isProtected = protectedPrefixes.some(p => path.startsWith(p))

  // Non connecté → login
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const role = user.app_metadata?.role as string | undefined

    // Connecté sur /login ou /client-login → rediriger vers la bonne section
    if (path === '/login' || path === '/client-login') {
      if (role === 'admin') return NextResponse.redirect(new URL('/admin', request.url))
      if (role === 'chauffeur') return NextResponse.redirect(new URL('/chauffeur', request.url))
      return NextResponse.redirect(new URL('/espace-client', request.url))
    }

    // Protection par rôle sur les sections réservées
    if (isProtected) {
      if (role === 'admin' && !path.startsWith('/admin'))
        return NextResponse.redirect(new URL('/admin', request.url))
      if (role === 'chauffeur' && !path.startsWith('/chauffeur'))
        return NextResponse.redirect(new URL('/chauffeur', request.url))
      if (role !== 'admin' && role !== 'chauffeur' && path.startsWith('/admin'))
        return NextResponse.redirect(new URL('/login', request.url))
      if (role !== 'admin' && role !== 'chauffeur' && path.startsWith('/chauffeur'))
        return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/chauffeur/:path*', '/espace-client/:path*', '/login', '/client-login', '/client-login/:path*'],
}
