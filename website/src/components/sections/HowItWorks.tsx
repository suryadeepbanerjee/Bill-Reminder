// HowItWorks.tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
	{
		title: "Add your bills",
		body: "Enter any recurring payment in seconds — subscriptions, utilities, EMIs, rent, or insurance. Set the amount, start date, and billing cycle.",
		detail: (
			<div className="space-y-2">
				{[
					{ name: "Netflix", cycle: "Monthly", amount: "₹649" },
					{ name: "Home Loan EMI", cycle: "Monthly", amount: "₹18,000" },
					{ name: "Electricity", cycle: "Bi-monthly", amount: "₹1,200" },
				].map((b, i) => (
					<div key={i} className="flex justify-between items-center p-2 bg-canvas/60 rounded-lg border border-border/50">
						<div>
							<p className="text-xs font-semibold text-primary">{b.name}</p>
							<p className="text-[10px] text-secondary">{b.cycle}</p>
						</div>
						<span className="text-[13px] font-bold text-primary font-mono tabular-nums">{b.amount}</span>
					</div>
				))}
			</div>
		),
	},
	{
		title: "Set your reminders",
		body: "Choose when you want to be notified — 7 days before, 3 days, the day before, and on the due date. Push and email notifications both supported.",
		detail: (
			<div className="space-y-1">
				{[
					{ label: "7 days before", on: true },
					{ label: "3 days before", on: true },
					{ label: "Day before", on: true },
					{ label: "On due date", on: true },
					{ label: "Day after (overdue)", on: false },
				].map((r, i) => (
					<div key={i} className={`flex items-center gap-2.5 py-1.5 ${i < 4 ? "border-b border-border/40" : ""}`}>
						<div
							className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border ${
								r.on ? "bg-accent border-accent" : "bg-transparent border-border"
							}`}
						>
							{r.on && (
								<svg width="10" height="10" fill="none" viewBox="0 0 10 10" stroke="var(--color-accent-text)" strokeWidth={2.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5L8.5 2" />
								</svg>
							)}
						</div>
						<span className={`text-xs ${r.on ? "text-primary" : "text-secondary"}`}>{r.label}</span>
					</div>
				))}
			</div>
		),
	},
	{
		title: "Mark as paid — or don't",
		body: "One tap to mark a bill as paid. Bill Reminder tracks the full history so you always know what's been settled and what's still pending.",
		detail: (
			<div className="space-y-2.5">
				<div className="p-3 bg-surface/30 border border-border/50 rounded-lg">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-surface border border-border/60 flex items-center justify-center text-accent">
							<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
								/>
							</svg>
						</div>
						<div>
							<p className="text-xs font-semibold text-primary">Netflix due in 2 days</p>
							<p className="text-[10px] text-secondary">₹649 · Tap to mark as paid</p>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-3 px-3.5 py-2.5 bg-canvas/60 border border-border/50 rounded-lg">
					<div className="w-5 h-5 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-success">
						<svg width="11" height="11" fill="none" viewBox="0 0 11 11" stroke="currentColor" strokeWidth={2.5}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5.5L4 8 9.5 2.5" />
						</svg>
					</div>
					<div className="flex-1">
						<p className="text-xs font-semibold text-primary">Spotify</p>
						<p className="text-[10px] text-success">Paid · 4 days ago</p>
					</div>
					<span className="text-xs font-bold text-secondary font-mono tabular-nums">₹119</span>
				</div>
			</div>
		),
	},
];

// Phone mockup component
function PhoneMockup({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative w-full max-w-[280px] aspect-[9/19] mx-auto">
			<div className="absolute inset-0 rounded-[3rem] border border-border/50 bg-surface shadow-xl overflow-hidden">
				{/* Status bar */}
				<div className="flex justify-between items-center px-6 pt-3 pb-1 text-[10px] text-secondary/70">
					<span>9:41</span>
					<div className="flex items-center gap-1">
						<span className="w-3.5 h-3.5 rounded-full border border-current" />
						<span className="text-xs">📶</span>
						<span className="text-xs">🔋</span>
					</div>
				</div>
				{/* Notch */}
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black/90 rounded-b-2xl" />
				{/* Content */}
				<div className="px-4 pt-2 pb-6 h-full overflow-y-auto scrollbar-hide">{children}</div>
			</div>
		</div>
	);
}

export default function HowItWorks() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<section id="how-it-works" ref={ref} className="section bg-canvas border-y border-border" aria-labelledby="how-it-works-heading">
			<div className="container max-w-5xl mx-auto px-6 md:px-10">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={inView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.55 }}
					className="mb-16 text-center"
				>
					<h2
						id="how-it-works-heading"
						className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-tight text-primary mb-4"
						style={{ textWrap: "balance" }}
					>
						Up and running in under a minute.
					</h2>
					<p className="text-base text-secondary max-w-[48ch] leading-[1.65] mx-auto">Three steps. No manual required.</p>
				</motion.div>

				<div className="space-y-24 md:space-y-32">
					{steps.map((step, index) => {
						const isEven = index % 2 === 0;
						return (
							<motion.div
								key={step.title}
								initial={{ opacity: 0, y: 30 }}
								animate={inView ? { opacity: 1, y: 0 } : {}}
								transition={{ duration: 0.6, delay: index * 0.1 }}
								className="flex flex-col md:flex-row items-center gap-10 md:gap-16"
							>
								{/* Text side */}
								<div className={`flex-1 md:flex-[0.55] space-y-4 ${isEven ? "md:order-1" : "md:order-2"}`}>
									<div className="relative">
										<span className="text-7xl md:text-8xl font-bold text-accent/10 select-none absolute -top-6 -left-4 md:-left-8">
											{String(index + 1).padStart(2, "0")}
										</span>
										<h3 className="text-2xl md:text-3xl font-bold tracking-tight text-primary relative">{step.title}</h3>
									</div>
									<p className="text-base text-secondary leading-relaxed max-w-[40ch]">{step.body}</p>
									{/* CTA bullet list (derived from detail, but we'll add some manual ones) */}
									<ul className="space-y-1.5 text-sm text-secondary">
										{index === 0 && (
											<>
												<li className="flex items-start gap-2">
													<span className="text-accent">✓</span>
													<span>Add any recurring payment</span>
												</li>
												<li className="flex items-start gap-2">
													<span className="text-accent">✓</span>
													<span>Set amount, start date, cycle</span>
												</li>
											</>
										)}
										{index === 1 && (
											<>
												<li className="flex items-start gap-2">
													<span className="text-accent">✓</span>
													<span>Multiple notification times</span>
												</li>
												<li className="flex items-start gap-2">
													<span className="text-accent">✓</span>
													<span>Push + email alerts</span>
												</li>
											</>
										)}
										{index === 2 && (
											<>
												<li className="flex items-start gap-2">
													<span className="text-accent">✓</span>
													<span>One‑tap payment logging</span>
												</li>
												<li className="flex items-start gap-2">
													<span className="text-accent">✓</span>
													<span>Complete history tracking</span>
												</li>
											</>
										)}
									</ul>
								</div>

								{/* Mockup side */}
								<div className={`flex-1 md:flex-[0.45] flex justify-center ${isEven ? "md:order-2" : "md:order-1"}`}>
									<PhoneMockup>{step.detail}</PhoneMockup>
								</div>
							</motion.div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
