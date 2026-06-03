'use client'

import { useEffect } from 'react'
import { fbPurchase } from '@/lib/pixel'

export default function PurchaseEvent() {
  useEffect(() => {
    fbPurchase(0, 'EUR')
  }, [])
  return null
}
