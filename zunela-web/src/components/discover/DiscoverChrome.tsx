"use client";

import Image from "next/image";
import Link from "next/link";
import { JourneySteps } from "@/components/journey/JourneySteps";

/** Cabecera de fichas bajo Descubrir: logo + recorrido (incluye avisos). */
export function DiscoverChrome() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/" className="inline-flex items-center">
        <Image
          src="/logo-zunela.png"
          alt="ZUNELA"
          width={1002}
          height={795}
          className="h-auto w-28"
          priority
        />
      </Link>
      <JourneySteps current="descubrir" />
    </header>
  );
}
