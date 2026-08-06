import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";

/* Bill row shown in the phone mockup */
function BillCard({
	icon,
	name,
	subtitle,
	amount,
	statusText,
	statusColor,
	statusIcon,
	actionText,
	actionIcon,
	actionColor,
}: {
	icon: React.ReactNode;
	name: string;
	subtitle?: string;
	amount: string;
	statusText: string;
	statusColor: "error" | "warning" | "secondary";
	statusIcon?: React.ReactNode;
	actionText?: string;
	actionIcon?: React.ReactNode;
	actionColor?: string;
}) {
	const colors = {
		error: "text-error bg-error/10 border border-error/20",
		warning: "text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20",
		secondary: "text-secondary bg-surface border border-border",
	};

	return (
		<div className="flex items-center gap-2.5 p-2.5 bg-surface border border-border rounded-xl mb-1.5">
			<div className="w-8 h-8 rounded-lg bg-canvas border border-border flex items-center justify-center text-secondary shrink-0">
				{icon}
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-[11px] font-bold text-primary truncate">{name}</p>
				{subtitle && <p className="text-[9px] text-secondary truncate mb-1">{subtitle}</p>}
				<div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${colors[statusColor]}`}>
					{statusIcon && <span className="text-[8px]">{statusIcon}</span>}
					<span className="text-[8px] font-semibold">{statusText}</span>
				</div>
			</div>
			<div className="text-right shrink-0 flex flex-col items-end justify-between h-full">
				<p className="text-[11px] font-bold text-primary tabular-nums mb-1">{amount}</p>
				{actionText && (
					<div className={`inline-flex items-center gap-0.5 ${actionColor || "text-success"}`}>
						{actionIcon && <span className="text-[10px]">{actionIcon}</span>}
						<span className="text-[9px] font-medium">{actionText}</span>
					</div>
				)}
			</div>
		</div>
	);
}

/* Floating card: category spend breakdown */
function CategoriesCard() {
	const cats = [
		{ label: "Subscriptions", pct: 42, color: "var(--color-primary)" },
		{ label: "Utilities", pct: 31, color: "var(--color-secondary)" },
		{ label: "Housing", pct: 27, color: "var(--color-border)" },
	];
	return (
		<motion.div
			initial={{ opacity: 0, x: 24, y: -12 }}
			animate={{ opacity: 1, x: 0, y: 0 }}
			transition={{ duration: 0.7, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
			className="hidden lg:block absolute top-[-8px] right-[-28px] w-44 p-3.5 bg-surface/90 backdrop-blur-md border border-border rounded-2xl shadow-raised z-20"
		>
			<p className="text-[9px] font-semibold text-secondary tracking-wider uppercase mb-2.5">By category</p>
			<div className="flex h-1.5 rounded-full overflow-hidden mb-2.5">
				{cats.map((c) => (
					<div key={c.label} style={{ width: `${c.pct}%`, background: c.color }} />
				))}
			</div>
			<div className="flex flex-col gap-1.5">
				{cats.map((c) => (
					<div key={c.label} className="flex items-center gap-1.5">
						<div style={{ background: c.color }} className="w-1.5 h-1.5 rounded-sm shrink-0" />
						<span className="text-[10px] text-secondary flex-1">{c.label}</span>
						<span className="text-[10px] font-bold text-primary font-mono tabular-nums">{c.pct}%</span>
					</div>
				))}
			</div>
		</motion.div>
	);
}

/* Floating card: payment timeline */
function TimelineCard() {
	const pts = [
		{ label: "Today", state: "overdue" as const },
		{ label: "Aug 2", state: "upcoming" as const },
		{ label: "Aug 5", state: "upcoming" as const },
		{ label: "Aug 9", state: "future" as const },
	];
	return (
		<motion.div
			initial={{ opacity: 0, x: -20, y: 16 }}
			animate={{ opacity: 1, x: 0, y: 0 }}
			transition={{ duration: 0.7, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
			className="hidden lg:block absolute bottom-9 left-[-36px] w-48 p-3.5 bg-surface/90 backdrop-blur-md border border-border rounded-2xl shadow-raised z-20"
		>
			<p className="text-[9px] font-semibold text-secondary tracking-wider uppercase mb-3">Payment timeline</p>
			<div className="flex items-center">
				{pts.map((p, i) => (
					<div key={p.label} className={`flex items-center ${i < pts.length - 1 ? "flex-1" : "flex-none"}`}>
						<div
							className={`w-2 h-2 rounded-full shrink-0 ${p.state === "overdue" ? "bg-error ring-2 ring-error/20" : p.state === "upcoming" ? "bg-primary" : "bg-border"}`}
						/>
						{i < pts.length - 1 && <div className="flex-1 h-px bg-border" />}
					</div>
				))}
			</div>
			<div className="flex justify-between mt-1.5">
				{pts.map((p) => (
					<span key={p.label} className={`text-[9px] ${p.state === "overdue" ? "text-error font-medium" : "text-secondary"}`}>
						{p.label}
					</span>
				))}
			</div>
		</motion.div>
	);
}

function PhoneMockup() {
	return (
		<motion.div
			initial={{ opacity: 0, y: 24, rotateX: 6 }}
			animate={{ opacity: 1, y: 0, rotateX: 0 }}
			transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
			style={{ perspective: 1000 }}
			className="relative z-10"
		>
			<div className="w-[264px] bg-canvas border border-border rounded-[32px] p-2.5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] relative z-10">
				<div className="rounded-[24px] overflow-hidden bg-canvas border border-border relative h-[530px] flex flex-col">
					<div className="px-4 py-2 flex justify-between items-center bg-canvas shrink-0">
						<span className="text-[9px] text-primary font-semibold font-mono tabular-nums">18:51</span>
						<div className="flex gap-1 items-center">
							<div className="flex gap-0.5 items-end h-2">
								<div className="w-0.5 h-1 bg-primary rounded-sm" />
								<div className="w-0.5 h-1.5 bg-primary rounded-sm" />
								<div className="w-0.5 h-2 bg-primary rounded-sm" />
								<div className="w-0.5 h-2 bg-primary/30 rounded-sm" />
							</div>
							<div className="w-3 h-1.5 bg-primary rounded-sm opacity-80 ml-1" />
						</div>
					</div>
					<div className="px-3.5 pb-3.5 bg-canvas flex-1 overflow-y-auto scrollbar-hide">
						<div className="mb-3.5">
							<p className="text-[9px] text-secondary mb-0.5">Good evening, Suryadeep</p>
							<p className="text-[16px] font-bold text-primary tracking-tight">Your bills</p>
						</div>

						<div className="flex gap-1.5 mb-3.5">
							{[
								{ label: "OVERDUE", value: "1", bg: "bg-[#2a1315] border-[#3b181a]", text: "text-[#ef4444]", icon: (
									<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
								) },
								{ label: "TODAY", value: "1", bg: "bg-[#252210] border-[#343018]", text: "text-[#eab308]", icon: (
									<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
								) },
								{ label: "UPCOMING", value: "2", bg: "bg-[#102418] border-[#183624]", text: "text-[#22c55e]", icon: (
									<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
								) },
							].map((c) => (
								<div key={c.label} className={`flex-1 px-1.5 py-1.5 rounded-lg border ${c.bg}`}>
									<p className={`text-[8px] font-bold uppercase mb-0.5 flex items-center gap-1 ${c.text}`}>
										{c.icon} {c.label}
									</p>
									<p className={`text-[15px] font-bold tabular-nums ${c.text}`}>{c.value}</p>
								</div>
							))}
						</div>

						<div className="bg-primary text-canvas px-3 py-3 rounded-[14px] flex items-center justify-between mb-4">
							<div>
								<p className="text-[9px] font-medium opacity-80 mb-0.5">Total owed now</p>
								<p className="text-[17px] font-bold tabular-nums">₹1,198</p>
							</div>
							<div className="bg-[#1a1a1a] text-white px-2.5 py-1.5 rounded-lg text-[9px] font-bold border border-[#333]">
								View all
							</div>
						</div>

						<p className="text-[9px] text-secondary font-semibold mb-2">Action Required · 2</p>
						<BillCard
							icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>}
							name="Mobile"
							subtitle="BSNL"
							amount="₹899"
							statusText="11 days overdue"
							statusColor="error"
							statusIcon={<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>}
							actionText="Mark paid"
							actionIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
						/>
						<BillCard
							icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>}
							name="Amazon Prime"
							amount="₹299"
							statusText="Due today"
							statusColor="warning"
							statusIcon={<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>}
							actionText="Mark paid"
							actionIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
						/>

						<p className="text-[9px] text-secondary font-semibold mb-2 mt-3">Upcoming</p>
						<BillCard
							icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>}
							name="College Fees"
							subtitle="IILM University"
							amount="₹1,00,000"
							statusText="In 2 days"
							statusColor="secondary"
							statusIcon={<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
						/>
						<BillCard
							icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>}
							name="Wifi"
							subtitle="Airtel"
							amount="₹706"
							statusText="In 5 days"
							statusColor="secondary"
							statusIcon={<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
						/>
					</div>

					{/* Add Bill FAB */}
					<div className="absolute bottom-16 right-3 bg-[#eab308] text-[#1a1a1a] px-3 py-2.5 rounded-full flex items-center gap-1.5 shadow-lg">
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
						<span className="text-[10px] font-bold pr-1">Add bill</span>
					</div>

					{/* Bottom Nav */}
					<div className="px-4 py-2.5 bg-[#1a1a1a] border-t border-[#333] flex justify-between items-center shrink-0">
						<div className="flex flex-col items-center gap-0.5 text-white">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
							<span className="text-[8px] font-medium">Home</span>
						</div>
						<div className="flex flex-col items-center gap-0.5 text-secondary">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
							<span className="text-[8px] font-medium">Bills</span>
						</div>
						<div className="flex flex-col items-center gap-0.5 text-secondary">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
							<span className="text-[8px] font-medium">Settings</span>
						</div>
					</div>
				</div>
			</div>
			<CategoriesCard />
			<TimelineCard />
		</motion.div>
	);
}

export default function Hero() {
	return (
		<section
			id="hero"
			aria-labelledby="hero-heading"
			className="relative mx-auto w-full pt-[140px] md:pt-[160px] pb-16 px-6 md:px-8
      min-h-[calc(100vh-40px)] overflow-hidden
      bg-[linear-gradient(to_bottom,#fff,#ffffff_45%,var(--color-canvas)_100%)]
      dark:bg-[linear-gradient(to_bottom,#000,var(--color-canvas)_38%,#1c1e24_70%,var(--color-canvas)_100%)]
      rounded-b-xl"
		>
			{/* Ledger grid — tight to the content, not full-bleed */}
			<div
				className="absolute -z-10 inset-0 opacity-[0.5] h-[560px] w-full
        bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)]
        dark:bg-[linear-gradient(to_right,#242830_1px,transparent_1px),linear-gradient(to_bottom,#242830_1px,transparent_1px)]
        bg-[size:6rem_3.2rem]
        [mask-image:radial-gradient(ellipse_60%_45%_at_65%_15%,#000_60%,transparent_100%)]"
				aria-hidden="true"
			/>

			{/* Grain — breaks up the flat gradient so it doesn't read as templated */}
			<div
				className="absolute -z-10 inset-0 opacity-[0.035] dark:opacity-[0.06] pointer-events-none mix-blend-overlay"
				style={{
					backgroundImage:
						"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
				}}
				aria-hidden="true"
			/>

			{/* Gold spotlight — anchored behind the phone, not a blob behind the whole page */}
			<div
				className="hidden lg:block absolute -z-10 right-[4%] top-[6%] h-[560px] w-[560px]
        rounded-full pointer-events-none
        bg-[radial-gradient(circle,rgba(186,150,24,0.16)_0%,transparent_70%)]
        dark:bg-[radial-gradient(circle,rgba(186,150,24,0.14)_0%,transparent_70%)]"
				aria-hidden="true"
			/>

			{/* Due-date horizon — the one signature element, echoes the Timeline card */}
			<div
				className="absolute -z-10 left-0 right-0 top-[62%] h-px pointer-events-none
        bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent"
				aria-hidden="true"
			>
				<div className="absolute left-1/2 -translate-x-1/2 -top-[3px] w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(186,150,24,0.5)]" />
			</div>

			<div className="container mx-auto px-6 relative z-10">
				<div className="flex flex-col lg:flex-row items-center justify-center gap-20 lg:gap-32">
					{/* ── Left: Copy ── */}
					<div className="max-w-[560px] text-left">
						<motion.div
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
						>
							{/* Status badge */}
							<div className="inline-flex items-center gap-1.5 py-1.5 pl-2 pr-3 bg-surface border border-border rounded-full mb-7 shadow-resting">
								<div className="w-[18px] h-[18px] rounded-[5px] bg-accent flex items-center justify-center">
									<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
										<path d="M5 1C3.34 1 2 2.27 2 3.83V7h6V3.83C8 2.27 6.66 1 5 1Z" fill="var(--color-accent-text)" />
										<rect x="1.5" y="6.75" width="7" height="0.9" rx="0.45" fill="var(--color-accent-text)" />
										<circle cx="5" cy="8.5" r="0.75" fill="var(--color-accent-text)" />
									</svg>
								</div>
								<span className="text-xs font-medium text-primary">Open source · MIT License</span>
							</div>

							<h1
								id="hero-heading"
								className="text-[clamp(2.6rem,5.5vw,4.5rem)] font-extrabold tracking-tight leading-[1.05] text-primary mb-4"
								style={{ textWrap: "balance" as any }}
							>
								Bill Reminder
							</h1>

							<p
								className="text-[clamp(1.25rem,2.4vw,1.75rem)] font-bold text-primary/85 tracking-tight leading-snug mb-3"
								style={{ textWrap: "balance" as any }}
							>
								Never miss another payment.
							</p>

							<p className="text-[clamp(15px,2vw,17px)] text-primary/70 leading-relaxed max-w-[60ch] mb-9">
								Bill Reminder is a cross-platform application that helps you manage subscriptions, utility bills, mobile
								recharges, rent, EMIs and other recurring payments. It pairs smart reminders and email + push
								notifications with secure cloud sync, payment history, offline support and private-by-design
								authentication — so you never pay a late fee again.
							</p>

							<div className="flex items-center gap-5 flex-wrap">
								<a
									href="https://github.com/suryadeepbanerjee/Bill-Reminder/releases/latest"
									target="_blank"
									rel="noopener noreferrer"
									style={{ textDecoration: "none" }}
								>
									<Button
										size="lg"
										icon={
											<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
												/>
											</svg>
										}
									>
										Download App
									</Button>
								</a>
								<Link
									to="/sign-in"
									className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-primary/80 hover:text-primary transition-colors"
								>
									Sign in
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
									</svg>
								</Link>
							</div>

							{/* Trust row — this, not the hero copy, is what Google's OAuth brand review actually reads on your homepage */}
							<div className="flex items-center gap-2 mt-5 text-xs text-secondary flex-wrap">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-70">
									<rect x="3" y="11" width="18" height="10" rx="2" />
									<path d="M7 11V7a5 5 0 0110 0v4" />
								</svg>
								<span>Google sign-in reads only your name &amp; email</span>
								<span className="opacity-40">·</span>
								<Link to="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-primary transition-colors">
									Privacy Policy
								</Link>
								<span className="opacity-40">·</span>
								<Link to="/terms" className="underline decoration-dotted underline-offset-2 hover:text-primary transition-colors">
									Terms
								</Link>
							</div>

							{/* Metrics — separate glass tiles so each stat reads as its own card */}
							<div className="flex gap-3 sm:gap-4 mt-11 flex-wrap justify-center sm:justify-start">
								{[
									{ value: "Free", label: "No subscription fee" },
									{ value: "Offline", label: "Works without internet" },
									{ value: "Private", label: "Your data, your rules" },
								].map((m) => (
									<div
										key={m.value}
										className="bg-surface/60 backdrop-blur-md border border-border rounded-2xl px-5 py-4 shadow-resting"
									>
										<p className="text-[17px] font-bold text-primary tracking-tight mb-1">{m.value}</p>
										<p className="text-sm text-secondary">{m.label}</p>
									</div>
								))}
							</div>
						</motion.div>
					</div>

					{/* ── Right: Phone ── */}
					<div className="flex justify-center relative mt-20 lg:mt-0 flex-shrink-0">
						<div
							className="absolute inset-[-40px] bg-[radial-gradient(ellipse_at_center,var(--color-border)_0%,transparent_65%)] rounded-full pointer-events-none"
							aria-hidden="true"
						/>
						<PhoneMockup />
					</div>
				</div>
			</div>
		</section>
	);
}
