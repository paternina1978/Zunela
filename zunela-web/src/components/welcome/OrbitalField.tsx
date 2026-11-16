export function OrbitalField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 -top-28 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(10,111,108,0.16),transparent_68%)]" />
      <div className="absolute -bottom-24 -right-16 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(201,164,74,0.18),transparent_70%)]" />
      <div className="grain absolute inset-0" />

      <svg
        className="orbit-slow absolute -left-10 top-16 h-[28rem] w-[28rem] opacity-40 max-md:h-72 max-md:w-72"
        viewBox="0 0 400 400"
        fill="none"
      >
        <circle cx="200" cy="200" r="148" stroke="#0a6f6c" strokeWidth="1.2" />
        <circle cx="200" cy="52" r="5" fill="#c9a44a" />
        <circle cx="200" cy="348" r="5" fill="#c9a44a" />
        <circle cx="52" cy="200" r="5" fill="#c9a44a" />
        <circle cx="348" cy="200" r="5" fill="#c9a44a" />
      </svg>

      <svg
        className="orbit-slower absolute -right-24 bottom-10 h-[26rem] w-[26rem] opacity-30 max-md:hidden"
        viewBox="0 0 400 400"
        fill="none"
      >
        <ellipse
          cx="200"
          cy="200"
          rx="170"
          ry="62"
          stroke="#c9a44a"
          strokeWidth="1.4"
          transform="rotate(-18 200 200)"
        />
        <ellipse
          cx="200"
          cy="200"
          rx="170"
          ry="62"
          stroke="#0a6f6c"
          strokeWidth="1"
          transform="rotate(24 200 200)"
        />
      </svg>
    </div>
  );
}
