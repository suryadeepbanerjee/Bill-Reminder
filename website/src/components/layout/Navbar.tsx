import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../ui/Logo";
import { Button } from "../ui/Button";

const NAV_LINKS = [
	{ label: "Features", href: "/#features" },
	{ label: "How it Works", href: "/#how-it-works" },
	{ label: "Download", href: "/#download" },
	{ label: "FAQ", href: "/#faq" },
];

export default function Navbar() {
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);
	const { pathname } = useLocation();

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 32);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	// close menu on route change
	useEffect(() => setOpen(false), [pathname]);

	const isAuth = ["/sign-in", "/sign-in-code", "/sign-up", "/forgot-password", "/reset-password"].includes(pathname);

	return (
		<>
			<header
				role="banner"
				className={`fixed top-0 left-0 right-0 z-[100] transition-[padding] duration-250 ease-out ${scrolled ? "py-2" : "py-4"}`}
			>
				<div
					className={`mx-auto px-6 flex items-center justify-between transition-all duration-250 ease-out ${scrolled ? "max-w-[calc(100%-48px)] py-2.5 bg-canvas/90 backdrop-blur-md rounded-2xl border border-border shadow-resting" : "max-w-[1360px] bg-transparent"}`}
				>
					{isAuth ? (
						// Auth pages: simple flex layout (logo left, actions right)
						<>
							<Link to="/" className="flex items-center gap-3 no-underline">
								<Logo />
							</Link>
							<div className="flex items-center gap-2">
								<Link to="/sign-in">
									<Button variant="secondary" size="sm">
										Sign in
									</Button>
								</Link>
								<Link to="/sign-up">
									<Button size="sm">Get started</Button>
								</Link>
							</div>
						</>
					) : (
						// Main pages: three‑column grid for perfect centering
						<div className="w-full grid grid-cols-[1fr_auto_1fr] items-center">
							{/* Left: Logo */}
							<div className="justify-self-start">
								<Link to="/" className="flex items-center gap-3 no-underline">
									<Logo />
								</Link>
							</div>

							{/* Center: Navigation links */}
							<nav role="navigation" aria-label="Main navigation" className="hidden md:flex items-center justify-center gap-1">
								{NAV_LINKS.map((l) => (
									<a
										key={l.label}
										href={l.href}
										className="px-3 py-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
									>
										{l.label}
									</a>
								))}
								<a
									href="https://github.com/suryadeepbanerjee/Bill-Reminder"
									target="_blank"
									rel="noopener noreferrer"
									className="px-3 py-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
								>
									GitHub
								</a>
							</nav>

							{/* Right: Action buttons + hamburger (visible on mobile) */}
							<div className="justify-self-end flex items-center gap-2">
								<div className="hidden md:flex items-center gap-2">
									<Link to="/sign-in">
										<Button variant="secondary" size="sm">
											Sign in
										</Button>
									</Link>
									<Link to="/sign-up">
										<Button size="sm">Get started</Button>
									</Link>
								</div>

								{/* Mobile hamburger */}
								<button
									onClick={() => setOpen((v) => !v)}
									aria-label={open ? "Close menu" : "Open menu"}
									aria-expanded={open}
									className="md:hidden flex p-2 text-secondary bg-transparent border-none cursor-pointer"
								>
									<svg width="20" height="20" fill="none" viewBox="0 0 20 20">
										{open ? (
											<path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
										) : (
											<path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
										)}
									</svg>
								</button>
							</div>
						</div>
					)}
				</div>
			</header>

			{/* Mobile drawer (unchanged) */}
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18 }}
						className="fixed top-[72px] left-4 right-4 bg-surface border border-border rounded-card p-3 z-[99] shadow-raised md:hidden"
					>
						{NAV_LINKS.map((l) => (
							<a
								key={l.label}
								href={l.href}
								onClick={() => setOpen(false)}
								className="block px-3.5 py-2.5 rounded-lg text-secondary text-sm font-medium hover:text-primary hover:bg-white/5 transition-colors no-underline"
							>
								{l.label}
							</a>
						))}
						<div className="h-px bg-border my-2" />
						<Link to="/sign-in" onClick={() => setOpen(false)}>
							<Button variant="secondary" className="w-full mb-2">
								Sign in
							</Button>
						</Link>
						<Link to="/sign-up" onClick={() => setOpen(false)}>
							<Button className="w-full">Get started</Button>
						</Link>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
