// HowItWorks.tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
	{
		title: "Add your bills",
		body: "Enter any recurring payment in seconds — subscriptions, utilities, EMIs, rent, or insurance. Set the amount, start date, and billing cycle.",
		detail: (
			<div className="space-y-3">
				{[
					{ name: "Netflix", cycle: "Monthly", amount: "₹649" },
					{ name: "Home Loan EMI", cycle: "Monthly", amount: "₹18,000" },
					{ name: "Electricity", cycle: "Bi-monthly", amount: "₹1,200" },
				].map((b, i) => (
					<div
						key={i}
						className="flex justify-between items-center p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shadow-sm"
					>
						<div>
							<p className="text-sm font-semibold text-white">{b.name}</p>
							<p className="text-[10px] text-white/60">{b.cycle}</p>
						</div>
						<span className="text-sm font-bold text-accent font-mono tabular-nums">{b.amount}</span>
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
					<div key={i} className={`flex items-center gap-3 py-2 ${i < 4 ? "border-b border-white/10" : ""}`}>
						<div
							className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
								r.on ? "bg-accent border-accent" : "border-white/30 bg-transparent"
							}`}
						>
							{r.on && (
								<svg width="12" height="12" fill="none" viewBox="0 0 12 12" stroke="var(--color-accent-text)" strokeWidth={2.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
								</svg>
							)}
						</div>
						<span className={`text-sm ${r.on ? "text-white" : "text-white/50"}`}>{r.label}</span>
					</div>
				))}
			</div>
		),
	},
	{
		title: "Mark as paid — or don't",
		body: "One tap to mark a bill as paid. Bill Reminder tracks the full history so you always know what's been settled and what's still pending.",
		detail: (
			<div className="space-y-3">
				<div className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent">
							<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
								/>
							</svg>
						</div>
						<div>
							<p className="text-sm font-semibold text-white">Netflix due in 2 days</p>
							<p className="text-xs text-white/60">₹649 · Tap to mark as paid</p>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 shadow-sm">
					<div className="w-6 h-6 rounded-full bg-success/20 border border-success/30 flex items-center justify-center text-success">
						<svg width="14" height="14" fill="none" viewBox="0 0 14 14" stroke="currentColor" strokeWidth={2.5}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M2 7l3 3 6-6" />
						</svg>
					</div>
					<div className="flex-1">
						<p className="text-sm font-semibold text-white">Spotify</p>
						<p className="text-xs text-success/80">Paid · 4 days ago</p>
					</div>
					<span className="text-sm font-bold text-white/80 font-mono tabular-nums">₹119</span>
				</div>
			</div>
		),
	},
];

function PhoneMockup({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative w-full max-w-[300px] aspect-[9/19] mx-auto">
			<div className="absolute inset-0 rounded-[3.5rem] bg-black/90 shadow-2xl overflow-hidden">
				<div className="absolute inset-[4px] rounded-[3.2rem] bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] overflow-hidden">
					<div className="flex justify-between items-center px-7 pt-4 pb-2 text-[11px] text-white/60">
						<span className="font-semibold">9:41</span>
						<div className="flex items-center gap-2">
							<span className="w-4 h-4 rounded-full border border-current" />
							<span className="text-xs">📶</span>
							<span className="text-xs">🔋</span>
						</div>
					</div>
					<div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-7 bg-black rounded-b-2xl" />
					<div className="px-5 pt-3 pb-6 h-full overflow-y-auto scrollbar-hide">{children}</div>
				</div>
			</div>
		</div>
	);
}

export default function HowItWorks() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<section id="how-it-works" ref={ref} className="section bg-[#131418] border-y border-white/5" aria-labelledby="how-it-works-heading">
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
								<div className={`flex-1 md:flex-[0.55] space-y-4 ${isEven ? "md:order-1" : "md:order-2"}`}>
									<div className="space-y-2">
										<div className="text-[5rem] md:text-[7rem] font-black leading-none text-white/5 select-none">
											{String(index + 1).padStart(2, "0")}
										</div>

										<h3 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">{step.title}</h3>
									</div>
									<p className="text-base text-secondary leading-relaxed max-w-[40ch]">{step.body}</p>
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
