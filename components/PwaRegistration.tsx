'use client'
import { useEffect } from 'react'

export default function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/my-expense-tracker/sw.js', {
        scope: '/my-expense-tracker/',
      })
    }
  }, [])
  return null
}
