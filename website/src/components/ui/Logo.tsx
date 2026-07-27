interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="35" height="35" x="0.5" y="0.5" rx="9.5" fill="url(#logo-gradient)" stroke="rgba(255,255,255,0.14)" />
      {/* Bell body */}
      <path
        d="M18 8C14.5 8 11.5 10.8 11.5 14.5V22H24.5V14.5C24.5 10.8 21.5 8 18 8Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Bell bottom */}
      <rect x="10" y="21.5" width="16" height="2" rx="1" fill="white" fillOpacity="0.95" />
      {/* Clapper */}
      <circle cx="18" cy="25.5" r="1.8" fill="white" fillOpacity="0.95" />
      {/* Highlight bar */}
      <rect x="15.5" y="11" width="5" height="1.5" rx="0.75" fill="white" fillOpacity="0.3" />
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
      </defs>
    </svg>
  );
}
