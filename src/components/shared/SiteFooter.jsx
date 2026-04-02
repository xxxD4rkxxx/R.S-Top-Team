// Resumo: rodapé reutilizável com marca da academia e links do Instagram.
import React from 'react'

export default function SiteFooter() {
  return (
    <div className="block px-4 md:px-6 pb-4 mt-6">
      <div className="border-t border-white/10 pt-3 text-xs text-gray-500">
        <div className="flex items-center gap-3 justify-between flex-nowrap overflow-x-auto">
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo-nav.png" alt="RS Top Team" className="w-7 h-7 rounded-full" style={{ boxShadow: '0 0 10px color-mix(in srgb, var(--clr-primary) 45%, transparent)' }} />
            <span className="text-white font-semibold whitespace-nowrap">RS Top Team · v2.0</span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <a href="https://www.instagram.com/rstopteam_/" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white transition-colors insta-link">
              <img src="/instagram.png" alt="Instagram" className="w-4 h-4 insta-icon" />
              @rstopteam_
            </a>
            <a href="https://www.instagram.com/mad.exe/" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white transition-colors insta-link">
              <img src="/instagram.png" alt="Instagram" className="w-4 h-4 insta-icon" />
              @mad.exe
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
