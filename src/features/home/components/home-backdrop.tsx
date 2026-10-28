import Image from "next/image";
import photo from "@/assets/home-hero.webp";

/**
 * Photo behind the top of the home page (an editorial photo of the channel, not generated).
 * It is darkened so the text over it stays readable and fades into the page colour at the bottom.
 */
export function HomeBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] overflow-hidden"
    >
      <Image src={photo} alt="" fill sizes="100vw" className="object-cover object-[50%_28%]" />
      <div className="absolute inset-0 bg-bg/70" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-linear-to-b from-transparent to-bg" />
    </div>
  );
}
