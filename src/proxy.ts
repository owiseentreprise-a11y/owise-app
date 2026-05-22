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

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Pour tout utilisateur connecté sur une route protégée ou /login → vérifier le rôle
  if (user && (path === '/login' || isProtected)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile as any)?.role

    // Rediriger vers la bonne section si l'utilisateur est sur la mauvaise
    if (role === 'admin' && !path.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (role === 'chauffeur' && !path.startsWith('/chauffeur')) {
      return NextResponse.redirect(new URL('/chauffeur', request.url))
    }
    if (role === 'client' && !path.startsWith('/client')) {
      return NextResponse.redirect(new URL('/client', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/chauffeur/:path*', '/client/:path*', '/login'],
}
