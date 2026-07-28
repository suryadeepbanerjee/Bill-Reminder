interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Bill Reminder Logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
