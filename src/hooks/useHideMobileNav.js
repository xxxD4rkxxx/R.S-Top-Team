import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

/**
 * Hook to automatically hide/show the mobile bottom navigation bar based on a boolean state.
 * @param {boolean} isOpen - Whether the overlay/modal is open.
 */
export function useHideMobileNav(isOpen) {
  const { setIsMobileNavHidden } = useApp()

  useEffect(() => {
    if (isOpen) {
      setIsMobileNavHidden(true)
    } else {
      setIsMobileNavHidden(false)
    }
    
    // Cleanup ensures the nav is restored when the component unmounts
    return () => {
      setIsMobileNavHidden(false)
    }
  }, [isOpen, setIsMobileNavHidden])
}
