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

  // Pages de login — jamais protégées
  const loginPages = ['/login', '/client-login', '/sous-traitant-login']
  const isLoginPage = loginPages.includes(path)

  // Pages protégées — /sous-traitant-login ne doit PAS matcher /sous-traitant
  const isProtected = !isLoginPage && (
    path === '/admin'           || path.startsWith('/admin/') ||
    path === '/chauffeur'       || path.startsWith('/chauffeur/') ||
    path === '/espace-client'   || path.startsWith('/espace-client/') ||
    path === '/sous-traitant'   || path.startsWith('/sous-traitant/')
  )

  // Non connecté sur page protégée → login
  if (isProtected && !user) {
    const loginPage = (path === '/sous-traitant' || path.startsWith('/sous-traitant/'))
      ? '/sous-traitant-login'
      : '/login'
    return NextResponse.redirect(new URL(loginPage, request.url))
  }

  if (user) {
    const role = user.app_metadata?.role as string | undefined

    // Connecté sur une page de login → rediriger vers la bonne section
    if (isLoginPage) {
      if (role === 'admin')         return NextResponse.redirect(new URL('/admin', request.url))
      if (role === 'chauffeur')     return NextResponse.redirect(new URL('/chauffeur', request.url))
      if (role === 'sous_traitant') return NextResponse.redirect(new URL('/sous-traitant', request.url))
      return NextResponse.redirect(new URL('/espace-client', request.url))
    }

    // Protection par rôle sur les sections réservées
    if (isProtected) {
      // Admin hors de /admin → renvoyer sur /admin
      if (role === 'admin' && !path.startsWith('/admin'))
        return NextResponse.redirect(new URL('/admin', request.url))

      // Chauffeur hors de /chauffeur → renvoyer sur /chauffeur
      if (role === 'chauffeur' && !path.startsWith('/chauffeur'))
        return NextResponse.redirect(new URL('/chauffeur', request.url))

      // Sous-traitant hors de /sous-traitant → renvoyer sur /sous-traitant
      if (role === 'sous_traitant' && !path.startsWith('/sous-traitant'))
        return NextResponse.redirect(new URL('/sous-traitant', request.url))

      // Mauvais rôle sur /sous-traitant → login sous-traitant
      if ((path === '/sous-traitant' || path.startsWith('/sous-traitant/'))
          && role !== 'sous_traitant' && role !== 'admin')
        return NextResponse.redirect(new URL('/sous-traitant-login', request.url))

      // Non admin/chauffeur sur /admin ou /chauffeur → login
      if (role !== 'admin' && path.startsWith('/admin'))
        return NextResponse.redirect(new URL('/login', request.url))
      if (role !== 'admin' && role !== 'chauffeur' && path.startsWith('/chauffeur'))
        return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*', '/chauffeur/:path*', '/espace-client/:path*',
    '/sous-traitant/:path*', '/sous-traitant',
    '/login', '/client-login', '/client-login/:path*', '/sous-traitant-login',
  ],
}
