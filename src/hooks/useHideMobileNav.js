import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

/**
 * Hook to automatically hide/show the mobile bottom navigation bar based on a boolean state.
 * @param {boolean} isOpen - Whether the overlay/modal is open.
 */
export function useHideMobileNav(isOpen) {
  const { setIsMobileNavHidden } = useApp()

  useEffect(() => {
    const mainContent = document.querySelector('.main-content')

    if (isOpen) {
      setIsMobileNavHidden(true)
      document.body.style.overflow = 'hidden'
      if (mainContent) mainContent.style.overflow = 'hidden'
    } else {
      setIsMobileNavHidden(false)
      document.body.style.overflow = ''
      if (mainContent) mainContent.style.overflow = ''
    }

    return () => {
      setIsMobileNavHidden(false)
      document.body.style.overflow = ''
      if (mainContent) mainContent.style.overflow = ''
    }
  }, [isOpen, setIsMobileNavHidden])
}




