/**
 * La rubrique « Mesurer » : Chiffres, Visiteurs, Estimations, Tunnel.
 *
 * Un GROUPE DE ROUTES — le dossier entre parenthèses — n'apparaît pas dans
 * l'adresse : /admin/stats reste /admin/stats. Il sert uniquement à poser
 * cette mise en page commune au-dessus des quatre pages, sans modifier une
 * seule ligne de chacune.
 *
 * C'est ce qui permet d'avoir UNE entrée au menu au lieu de quatre, sans
 * recopier une barre d'onglets dans quatre fichiers — quatre copies qui
 * auraient fini par diverger, comme le document de facture l'a fait.
 */
import OngletsMesures from './OngletsMesures'

export default function MesuresLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OngletsMesures />
      {children}
    </>
  )
}
