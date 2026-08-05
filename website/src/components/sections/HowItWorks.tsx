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
		title: "Flexible scheduling",
		body: "Handle any kind of payment. Whether it's a fixed monthly bill, a prepaid mobile recharge, or a wallet top-up, you can set the exact rules for when it repeats.",
		detail: (
			<div className="space-y-3">
				<div className="space-y-2">
					<p className="text-[10px] font-semibold text-white/80 px-1">What type of bill is this?</p>
					{[
						{ title: "Fixed due date", desc: "Due on a specific day each cycle", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>, selected: false },
						{ title: "Prepaid / Recharge", desc: "Pay upfront — mobile, OTT", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>, selected: true },
						{ title: "Wallet / Balance", desc: "Check periodically and top up", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>, selected: false },
					].map((t, i) => (
						<div key={i} className={`flex gap-3 p-2.5 rounded-xl border ${t.selected ? "bg-accent/10 border-accent" : "bg-white/5 border-white/10"} transition-colors`}>
							<div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.selected ? "bg-accent text-[#1a1a1a]" : "bg-white/5 text-white/50"}`}>
								{t.icon}
							</div>
							<div className="flex-1 min-w-0">
								<p className={`text-xs font-semibold ${t.selected ? "text-white" : "text-white/80"}`}>{t.title}</p>
								<p className="text-[9px] text-white/50 truncate mt-0.5">{t.desc}</p>
							</div>
							{t.selected && (
								<div className="shrink-0 flex items-center">
									<div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center">
										<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
									</div>
								</div>
							)}
						</div>
					))}
				</div>
				<div className="mt-4 pt-4 border-t border-white/10">
					<p className="text-[10px] font-semibold text-white/80 px-1 mb-2">Schedule</p>
					<div className="grid grid-cols-2 gap-2">
						{["Monthly", "Yearly", "Every X days"].map((s, i) => (
							<div key={i} className={`px-2.5 py-2 text-xs rounded-lg border ${i === 0 ? "bg-accent/10 border-accent text-accent font-semibold" : "bg-white/5 border-white/10 text-white/70"}`}>
								{s}
							</div>
						))}
					</div>
				</div>
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
