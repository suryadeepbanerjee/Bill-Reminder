// Features.tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const features = [
	{
		title: "Smart Reminders",
		body: "Customisable alerts at 7 days, 3 days, 1 day, and on the due date. Never pay a late fee again.",
		icon: (
			<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
				/>
			</svg>
		),
	},
	{
		title: "Any Billing Cycle",
		body: "Weekly, monthly, quarterly, annually — any recurring payment across subscriptions, utilities, EMIs, and insurance.",
		icon: (
			<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
				/>
			</svg>
		),
	},
	{
		title: "Offline First",
		body: "Every feature works without internet. Your bills are always accessible, and changes sync automatically.",
		icon: (
			<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a9 9 0 000 12.728M9.172 9.172a5 5 0 000 7.071M12 12h.01"
				/>
			</svg>
		),
	},
	{
		title: "Categories",
		body: "Group bills into labelled categories with custom colours. See exactly where your money goes each month.",
		icon: (
			<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
				/>
			</svg>
		),
	},
	{
		title: "Payment History",
		body: "Every bill, every cycle, every payment — logged. Review past payments and track spending trends over time.",
		icon: (
			<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
				/>
			</svg>
		),
	},
	{
		title: "Secure Cloud Sync",
		body: "Row-level security means no query can ever read another user's data. Your financial data is private by design.",
		icon: (
			<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
		),
	},
];

export default function Features() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<section
			id="features"
			ref={ref}
			className="section bg-[#131418]" // Dark background matching the design
			aria-labelledby="features-heading"
		>
			<div className="container max-w-5xl mx-auto px-6 md:px-10">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={inView ? { opacity: 1, y: 0 } : {}}
					transition={{ duration: 0.55 }}
					className="mb-16 text-center"
				>
					<h2
						id="features-heading"
						className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-tight text-primary mb-4"
						style={{ textWrap: "balance" }}
					>
						One purpose. Done right.
					</h2>
					<p className="text-base text-secondary max-w-[48ch] leading-[1.65] mx-auto">
						No bloat, no subscription tiers, no dark patterns. Bill Reminder does exactly one thing — and it does it exceptionally well.
					</p>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
					{features.map((feature, index) => (
						<motion.div
							key={feature.title}
							initial={{ opacity: 0, y: 12 }}
							animate={inView ? { opacity: 1, y: 0 } : {}}
							transition={{ duration: 0.4, delay: index * 0.05 }}
							className={`
                group flex items-start gap-4 py-5
                ${index < features.length - 1 ? "border-b border-white/5" : ""}
                ${index % 2 === 0 ? "md:border-r md:border-white/5 md:pr-8" : "md:pl-8"}
                ${index >= features.length - 2 ? "md:border-b-0" : ""}
                hover:bg-white/5 -mx-4 px-4 rounded-lg transition-colors duration-300
              `}
						>
							<div className="shrink-0 w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-accent transition-colors duration-300 group-hover:border-accent/40">
								{feature.icon}
							</div>
							<div className="flex-1 min-w-0">
								<h3 className="text-base font-semibold tracking-tight text-primary mb-1">{feature.title}</h3>
								<p className="text-sm text-secondary leading-relaxed max-w-[48ch]">{feature.body}</p>
							</div>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
