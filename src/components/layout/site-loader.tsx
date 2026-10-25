import Image from "next/image";
import logo from "@/assets/logo.png";
import { BrandSpinner } from "@/components/ui/loader";
import { ru } from "@/messages/ru";

/** Marks the document as ready once everything has loaded (or at once if it already has). */
export const READY_SCRIPT = `(function(){var d=document.documentElement;function r(){d.setAttribute('data-ready','')}if(document.readyState==='complete'){r()}else{window.addEventListener('load',r)}})();`;

/**
 * Full-page cover for the first visit: the page is not shown until it has loaded. It is part of the
 * server HTML (so it paints first) and lifts on the window load event; a CSS timer lifts it anyway
 * after a few seconds, and without scripts it never blocks (see globals.css).
 */
export function SiteLoader() {
  return (
    <>
      <div
        id="site-loader"
        role="status"
        aria-label={ru.common.loading}
        className="site-loader fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg"
      >
        <Image src={logo} alt="" width={96} height={96} priority className="h-24 w-24" />
        <BrandSpinner />
      </div>
      <script dangerouslySetInnerHTML={{ __html: READY_SCRIPT }} />
      <noscript>
        <style>{".site-loader{display:none!important}"}</style>
      </noscript>
    </>
  );
}
