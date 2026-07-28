interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Bill Reminder Logo"
      className={`h-[48px] w-auto object-contain ${className}`}
    />
  );
}
