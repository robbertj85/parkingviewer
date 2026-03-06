'use client';

import { useEffect, useRef } from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/50 rounded-lg shadow-xl max-w-lg w-[calc(100%-2rem)] sm:w-full p-0 overflow-hidden fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 max-h-[90vh]"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Over Parkeerviewer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Sluiten"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-600">
          <p>
            Deze viewer toont <strong>real-time bezettingsdata</strong> van parkeergarages in
            Nederland. Data wordt elk uur opgehaald en historisch opgeslagen.
          </p>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Bezettingsindicatie</h3>
            <p className="mb-2">Parkeergarages worden op de kaart gekleurd op basis van bezettingsgraad:</p>
            <ul className="space-y-1.5">
              {[
                { color: '#2563eb', label: 'Rustig', desc: 'Minder dan 30% bezet' },
                { color: '#3b82f6', label: 'Beschikbaar', desc: '30-60% bezet' },
                { color: '#eab308', label: 'Druk', desc: '60-80% bezet' },
                { color: '#f97316', label: 'Bijna vol', desc: '80-95% bezet' },
                { color: '#dc2626', label: 'Vol', desc: 'Meer dan 95% bezet' },
                { color: '#6b7280', label: 'Onbekend', desc: 'Geen bezettingsdata beschikbaar' },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span><strong>{item.label}</strong> - {item.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Data</h3>
            <ul className="space-y-1">
              <li>
                De parkeerdata is afkomstig van de{' '}
                <a
                  href="https://npropendata.rdw.nl/parkingdata/v2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  SPDP v2 Open Parkeerdata API
                </a>
              </li>
              <li>
                Data wordt elk uur automatisch opgehaald en opgeslagen
              </li>
              <li>
                Historische data is beschikbaar per uur, per dag
              </li>
              <li>
                Downloads beschikbaar per gemeente en voor heel Nederland
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">API</h3>
            <p>
              De Parkeerviewer biedt een gratis REST API aan. Bekijk de{' '}
              <a href="/api/v1/docs" className="text-blue-600 hover:underline">
                API documentatie
              </a>{' '}
              voor meer informatie.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Licentie</h3>
            <p>
              De brondata is gepubliceerd onder{' '}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/deed.nl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                CC-0 (publiek domein)
              </a>.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">
              <strong>Disclaimer:</strong> De getoonde bezettingsdata is indicatief en wordt niet
              gegarandeerd. Gebruik is geheel op eigen risico. De beschikbaarheid en nauwkeurigheid
              varieert per exploitant.
            </p>
            <p className="text-xs text-gray-400">
              Dit is een onofficieel project. Data: Open Parkeerdata (SPDP v2, CC-0).
              <br />
              &copy; {new Date().getFullYear()} Transport Beat BV
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
