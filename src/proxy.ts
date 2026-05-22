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

  const protectedPrefixes = ['/admin', '/chauffeur', '/client']
  const isProtected = protectedPrefixes.some(p => path.startsWith(p))

  // Non connecté → login
  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Connecté → rediriger vers la bonne section selon le rôle (app_metadata, pas de query DB)
  if (user) {
    const role = user.app_metadata?.role as string | undefined

    if (path === '/login') {
      if (role === 'admin') return NextResponse.redirect(new URL('/admin', request.url))
      if (role === 'chauffeur') return NextResponse.redirect(new URL('/chauffeur', request.url))
      return NextResponse.redirect(new URL('/client', request.url))
    }

    if (isProtected) {
      if (role === 'admin' && !path.startsWith('/admin'))
        return NextResponse.redirect(new URL('/admin', request.url))
      if (role === 'chauffeur' && !path.startsWith('/chauffeur'))
        return NextResponse.redirect(new URL('/chauffeur', request.url))
      if (role === 'client' && !path.startsWith('/client'))
        return NextResponse.redirect(new URL('/client', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/chauffeur/:path*', '/client/:path*', '/login'],
}
