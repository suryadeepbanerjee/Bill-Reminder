interface LogoProps {
	size?: number;
	className?: string;
}

export default function Logo({ size = 36, className = "" }: LogoProps) {
	return <img src="/fevicon.png?v=1" alt="Bill Reminder Logo" className={`h-[40px] w-auto object-contain ${className}`} />;
}
