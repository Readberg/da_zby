import Image from "next/image";
import logo from "@/assets/logo.png";
import { BrandSpinner } from "@/components/ui/loader";
import { getMessages } from "@/i18n/server";

/**
 * Marks the document as ready once what is on the first screen has loaded: the HTML (so the whole
 * streamed page is in), the fonts and the images in view. Embedded players and pictures far below
 * are not waited for (YouTube alone held the cover for seconds); a timer lifts it after 4 seconds
 * whatever happens.
 */
export const READY_SCRIPT = `(function(){var d=document.documentElement,done=false;function r(){if(done)return;done=true;d.setAttribute('data-ready','')}function go(){var fonts=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();var h=innerHeight;var waits=[].slice.call(document.images).filter(function(i){var b=i.getBoundingClientRect();return !i.complete&&b.bottom>0&&b.top<h}).map(function(i){return new Promise(function(res){i.addEventListener('load',res);i.addEventListener('error',res)})});Promise.all([fonts].concat(waits)).then(r,r)}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',go)}else{go()}setTimeout(r,4000)})();`;

/**
 * Full-page cover for the first visit: the page is not shown until it has loaded. It is part of the
 * server HTML (so it paints first) and lifts when the first screen is ready (see READY_SCRIPT); a CSS timer lifts it anyway
 * after a few seconds, and without scripts it never blocks (see globals.css).
 */
export function SiteLoader() {
  const t = getMessages();
  return (
    <>
      <div
        id="site-loader"
        role="status"
        aria-label={t.common.loading}
        className="site-loader fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-bg"
      >
        <Image src={logo} alt="" width={96} height={96} priority className="h-24 w-24" />
        <BrandSpinner />
      </div>
      <script dangerouslySetInnerHTML={{ __html: READY_SCRIPT }} />
      <noscript>
        <style>{".site-loader{display:none!important}body>*{visibility:visible!important}"}</style>
      </noscript>
    </>
  );
}
