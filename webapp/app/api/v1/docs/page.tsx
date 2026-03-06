'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

const SWAGGER_CSS_URL = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css';
const SWAGGER_JS_URL = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js';

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = SWAGGER_CSS_URL;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = SWAGGER_JS_URL;
    script.async = true;
    script.onload = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        // @ts-expect-error SwaggerUIBundle is loaded from CDN
        window.SwaggerUIBundle({
          url: '/openapi.json',
          dom_id: '#swagger-ui',
          presets: [
            // @ts-expect-error SwaggerUIBundle is loaded from CDN
            window.SwaggerUIBundle.presets.apis,
            // @ts-expect-error SwaggerUIBundle is loaded from CDN
            window.SwaggerUIBundle.SwaggerUIStandalonePreset
          ],
          layout: 'BaseLayout',
          deepLinking: true,
          showExtensions: true,
          showCommonExtensions: true,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Terug naar kaart</span>
          </Link>
          <div className="h-5 sm:h-6 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900">API</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="/openapi.json"
              download
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">OpenAPI Spec</span>
              <span className="sm:hidden">Spec</span>
            </a>
          </div>
        </div>
      </header>

      <div ref={containerRef} id="swagger-ui" className="swagger-container">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">API documentatie laden...</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 30px 0; }
        .swagger-ui .info .title { font-size: 2rem; }
        .swagger-ui .scheme-container { padding: 15px 0; }
        @media (max-width: 640px) {
          .swagger-ui .wrapper { padding: 0 8px; }
          .swagger-ui .info { margin: 16px 0; }
          .swagger-ui .info .title { font-size: 1.4rem; }
          .swagger-ui .opblock .opblock-summary { padding: 8px; }
          .swagger-ui .opblock-tag { font-size: 1rem; padding: 8px 0; }
          .swagger-ui table { font-size: 12px; }
          .swagger-ui .parameters-col_description input { font-size: 14px; }
        }
      `}</style>
    </div>
  );
}
