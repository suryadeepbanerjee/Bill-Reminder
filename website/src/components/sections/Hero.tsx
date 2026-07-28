import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "../ui/Button";

/* Bill row shown in the phone mockup — supports upcoming, overdue, paid, recurring */
function BillCard({
	emoji,
	name,
	amount,
	category,
	daysLeft,
	paid,
	overdue,
	recurring,
}: {
	emoji: string;
	name: string;
	amount: string;
	category: string;
	daysLeft?: number;
	paid?: boolean;
	overdue?: boolean;
	recurring?: boolean;
}) {
	return (
		<div className="flex items-center gap-2.5 py-2.5 border-b border-border/50">
			<div
				className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${overdue ? "bg-error/10" : "bg-surface border border-border"}`}
			>
				{emoji}
			</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<p className="text-xs font-semibold text-primary">{name}</p>
					{recurring && (
						<span className="inline-flex items-center gap-0.5 text-[8px] font-semibold text-secondary bg-surface border border-border rounded px-1 py-0.5">
							↻ recurring
						</span>
					)}
				</div>
				<p className="text-[10px] text-secondary mt-0.5">{category}</p>
			</div>
			<div className="text-right shrink-0">
				<p className="text-xs font-bold text-primary mb-0.5 font-mono tabular-nums">{amount}</p>
				{paid ? (
					<p className="text-[10px] text-success font-medium">✓ Paid</p>
				) : overdue ? (
					<p className="text-[10px] text-error font-semibold">Overdue</p>
				) : (
					<p className={`text-[10px] font-medium ${daysLeft! <= 2 ? "text-warning" : "text-secondary"}`}>
						{daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
					</p>
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
			{/* stacked bar */}
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
			<div className="w-[264px] bg-canvas border border-border rounded-[32px] p-3 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] relative z-10">
				{/* Screen */}
				<div className="rounded-[22px] overflow-hidden bg-canvas border border-border">
					{/* Status bar */}
					<div className="px-4 py-2.5 flex justify-between items-center bg-canvas">
						<span className="text-[10px] text-primary font-semibold font-mono tabular-nums">9:41</span>
						<div className="flex gap-1 items-center">
							<div className="w-3 h-1.5 bg-success rounded-sm opacity-80" />
						</div>
					</div>

					{/* App content */}
					<div className="px-3.5 pb-3.5 bg-canvas">
						{/* Header */}
						<div className="mb-3.5 flex items-start justify-between">
							<div>
								<p className="text-[10px] text-secondary mb-0.5">Good morning,</p>
								<p className="text-[15px] font-bold text-primary tracking-tight">Surya 👋</p>
							</div>
							<div className="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center">
								<svg width="12" height="12" viewBox="0 0 18 18" fill="none" className="text-secondary">
									<path d="M9 2C6.79 2 5 3.68 5 5.75V11H13V5.75C13 3.68 11.21 2 9 2Z" fill="currentColor" />
									<rect x="4" y="10.5" width="10" height="1.25" rx="0.625" fill="currentColor" />
									<circle cx="9" cy="13.5" r="1.2" fill="currentColor" />
								</svg>
							</div>
						</div>

						{/* Summary bar — monthly spending summary */}
						<div className="flex gap-1.5 mb-3.5">
							{[
								{ label: "Due this month", value: "₹4,850", bg: "bg-surface border border-border", text: "text-primary" },
								{ label: "Overdue", value: "₹1,200", bg: "bg-error/10 border border-error/20", text: "text-error" },
								{ label: "Paid", value: "₹794", bg: "bg-success/10 border border-success/20", text: "text-success" },
							].map((c) => (
								<div key={c.label} className={`flex-1 px-2 py-1.5 rounded-[10px] ${c.bg}`}>
									<p className="text-[7px] text-secondary mb-1">{c.label}</p>
									<p className={`text-[11.5px] font-bold font-mono tabular-nums ${c.text}`}>{c.value}</p>
								</div>
							))}
						</div>

						{/* Category filter chips */}
						<div className="flex gap-1.5 mb-3 overflow-hidden">
							{["All", "Streaming", "Utilities", "Housing"].map((c, i) => (
								<span
									key={c}
									className={`text-[9px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
										i === 0 ? "bg-primary text-canvas" : "bg-surface border border-border text-secondary"
									}`}
								>
									{c}
								</span>
							))}
						</div>

						{/* Bills */}
						<p className="text-[9px] text-secondary font-semibold tracking-wider uppercase mb-1">Upcoming</p>
						<BillCard emoji="⚡" name="Electricity" amount="₹1,200" category="Utilities" overdue />
						<BillCard emoji="📺" name="Netflix" amount="₹649" category="Streaming" daysLeft={2} recurring />
						<BillCard emoji="🎵" name="Spotify" amount="₹119" category="Music" daysLeft={5} recurring />
						<BillCard emoji="☁️" name="iCloud" amount="₹75" category="Storage" paid />
					</div>
				</div>

				{/* Home indicator */}
				<div className="flex justify-center pt-2">
					<div className="w-[60px] h-[3px] rounded-full bg-secondary/30" />
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
			aria-labelledby="hero-heading"
			className="relative mx-auto w-full pt-[100px] pb-16 px-6 md:px-8
      min-h-[calc(100vh-40px)] overflow-hidden rounded-b-xl
      bg-[linear-gradient(to_bottom,#fff,#ffffff_50%,#e8e8e8_88%)]
      dark:bg-[linear-gradient(to_bottom,#000,#0000_30%,#898e8e_78%,#ffffff_99%_50%)]"
		>
			{/* Grid BG */}
			<div
				className="absolute -z-10 inset-0 opacity-80 h-[600px] w-full
        bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)]
        dark:bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)]
        bg-[size:6rem_5rem]
        [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"
				aria-hidden="true"
			/>

			{/* Radial Accent (large glow at bottom) */}
			<div
				className="absolute left-1/2 top-[calc(100%-90px)] lg:top-[calc(100%-150px)]
        h-[500px] w-[700px] md:h-[500px] md:w-[1100px] lg:h-[750px] lg:w-[140%]
        -translate-x-1/2 rounded-[100%] border-[#B48CDE] bg-white dark:bg-black
        bg-[radial-gradient(closest-side,#fff_82%,#000000)]
        dark:bg-[radial-gradient(closest-side,#000_82%,#ffffff)]
        animate-fade-up pointer-events-none"
				aria-hidden="true"
			/>

			{/* Original ambient light (kept for extra glow but can be removed) */}
			<div
				className="absolute top-0 left-0 right-0 h-[500px] pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,var(--color-border)_0%,transparent_70%)]"
				aria-hidden="true"
			/>

			<div className="container mx-auto px-6 relative z-10">
				<div className="flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-24">
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
								className="text-[clamp(2.6rem,5.5vw,4.5rem)] font-extrabold tracking-tight leading-[1.05] text-primary mb-5"
								style={{ textWrap: "balance" as any }}
							>
								Never miss another
								<br />
								<span className="bg-gradient-to-r from-accent to-accent/60 bg-clip-text text-transparent">bill again.</span>
							</h1>

							<p className="text-[clamp(15px,2vw,17px)] text-secondary leading-relaxed max-w-[60ch] mb-9">
								Bill Reminder helps you stay ahead of recurring payments with intelligent reminders, offline support, cloud sync, and a
								clean experience designed to eliminate late fees and forgotten bills.
							</p>

							<div className="flex gap-4 flex-wrap">
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
								<Link to="/sign-in">
									<Button variant="secondary" size="lg">
										Sign In
									</Button>
								</Link>
							</div>

							{/* Metrics */}
							<div className="flex gap-7 mt-11 flex-wrap">
								{[
									{ value: "Free", label: "No subscription fee" },
									{ value: "Offline", label: "Works without internet" },
									{ value: "Private", label: "Your data, your rules" },
								].map((m) => (
									<div key={m.value}>
										<p className="text-[17px] font-bold text-primary tracking-tight mb-1">{m.value}</p>
										<p className="text-xs text-secondary">{m.label}</p>
									</div>
								))}
							</div>
						</motion.div>
					</div>

					{/* ── Right: Phone ── */}
					<div className="flex justify-center relative mt-20 lg:mt-0 flex-shrink-0">
						{/* Glow behind phone (original) */}
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
