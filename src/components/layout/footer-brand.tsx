"use client";

import Image from "next/image";

export default function FooterBrand() {
  return (
    <div className="flex items-center justify-center gap-2 py-3 text-white/30 border-t border-white/5">
      <Image
        src="/images/logo-white.png"
        alt="CoreByte"
        width={16}
        height={16}
        className="opacity-30"
      />
      <span className="text-[10px]">CoreByte Tecnologia</span>
    </div>
  );
}
