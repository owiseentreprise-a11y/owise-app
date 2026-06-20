import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Redirige en copiant les cookies Supabase rafraîchis sur la réponse.
// Sans ça : session expirée → Supabase rafraîchit dans le proxy → redirect sans cookies
// → prochain appel a encore l'ancien token expiré → boucle infinie (ERR_TOO_MANY_REDIRECTS)
function redirect(to: string, request: NextRequest, session: NextResponse, reason?: string): NextResponse {
  const url = new URL(to, request.url)
  if (reason) url.searchParams.set('dbg', reason)
  const res = NextResponse.redirect(url)
  session.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
  return res
}

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

  // Non connecté sur page protégée → login approprié
  if (isProtected && !user) {
    if (path === '/sous-traitant' || path.startsWith('/sous-traitant/'))
      return redirect('/sous-traitant-login', request, supabaseResponse, 'r1')
    if (path === '/espace-client' || path.startsWith('/espace-client/'))
      return redirect('/client-login', request, supabaseResponse, 'r2')
    return redirect('/login', request, supabaseResponse, 'r3-noauth')
  }

  if (user) {
    const role = user.app_metadata?.role as string | undefined

    // Connecté sur une page de login → rediriger vers la bonne section
    if (isLoginPage) {
      if (role === 'admin')     return redirect('/admin', request, supabaseResponse, 'r4')
      if (role === 'chauffeur') return redirect('/chauffeur', request, supabaseResponse, 'r5')
      // sous_traitant : portail ST par défaut, sauf /client-login qu'on laisse passer
      if (role === 'sous_traitant' && path !== '/client-login')
        return redirect('/sous-traitant', request, supabaseResponse, 'r6')
      // client / collaborateur / sous_traitant sur /client-login → espace-client
      if (path === '/client-login')
        return redirect('/espace-client', request, supabaseResponse, 'r7')
      // /login ou /sous-traitant-login connecté → section appropriée
      if (role === 'sous_traitant') return redirect('/sous-traitant', request, supabaseResponse, 'r8')
      return redirect('/espace-client', request, supabaseResponse, 'r9')
    }

    // Protection par rôle sur les sections réservées
    if (isProtected) {
      // Admin hors de /admin → renvoyer sur /admin
      if (role === 'admin' && !path.startsWith('/admin'))
        return redirect('/admin', request, supabaseResponse, 'r10')

      // Chauffeur hors de /chauffeur → renvoyer sur /chauffeur
      if (role === 'chauffeur' && !path.startsWith('/chauffeur'))
        return redirect('/chauffeur', request, supabaseResponse, 'r11')

      // Sous-traitant : autorisé sur /sous-traitant ET /chauffeur
      if (role === 'sous_traitant'
          && !path.startsWith('/sous-traitant')
          && !path.startsWith('/chauffeur'))
        return redirect('/sous-traitant', request, supabaseResponse, 'r12')

      // Mauvais rôle sur /sous-traitant → login sous-traitant
      if ((path === '/sous-traitant' || path.startsWith('/sous-traitant/'))
          && role !== 'sous_traitant' && role !== 'admin')
        return redirect('/sous-traitant-login', request, supabaseResponse, 'r13')

      // Non admin sur /admin → login
      if (role !== 'admin' && path.startsWith('/admin'))
        return redirect('/login', request, supabaseResponse, `r14-wrongrole-${role}`)

      // Non chauffeur / non sous_traitant sur /chauffeur → login
      if (role !== 'admin' && role !== 'chauffeur' && role !== 'sous_traitant'
          && path.startsWith('/chauffeur'))
        return redirect('/login', request, supabaseResponse, 'r15')
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
