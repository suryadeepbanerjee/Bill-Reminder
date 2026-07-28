import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const faqs = [
	{
		q: "Is Bill Reminder free?",
		a: "Yes — completely free. There are no subscription tiers, no feature gates, and no in-app purchases. It's MIT licensed open source software.",
	},
	{
		q: "Does it store my bank credentials?",
		a: "No. Bill Reminder never asks for bank credentials, card numbers, or financial institution access. You manually enter bill names and amounts. Nothing is connected to your bank.",
	},
	{
		q: "Does it work without internet?",
		a: "Yes. Every feature is available offline. When you reconnect, changes sync automatically across your devices via Supabase.",
	},
	{
		q: "Is there an iOS version?",
		a: "Not yet. The app currently ships on Android. iOS is on the roadmap — star the GitHub repository to follow progress.",
	},
	{
		q: "Can I export my data?",
		a: "Yes. You can request a full export of your data at any time by emailing support. We'll respond within 30 days.",
	},
	{
		q: "Who can see my bills?",
		a: "Only you. Each account uses row-level security at the database layer — no query, even from the server, can read another user's data.",
	},
];

export default function FAQ() {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });

	return (
		<section id="faq" ref={ref} className="section bg-canvas" aria-labelledby="faq-heading">
			<div className="container mx-auto px-6 max-w-[800px]">
				<div className="flex flex-col items-center">
					{/* Heading */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={inView ? { opacity: 1, y: 0 } : {}}
						transition={{ duration: 0.5 }}
						className="mb-14 text-center"
					>
						<h2
							id="faq-heading"
							className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-extrabold tracking-tight text-primary mb-3.5 mx-auto"
							style={{ textWrap: "balance" as any }}
						>
							Frequently asked questions
						</h2>
						<p className="text-[15px] text-secondary max-w-[36ch] mx-auto leading-[1.65]">
							Still have questions?{" "}
							<a
								href="https://github.com/suryadeepbanerjee/Bill-Reminder/issues"
								target="_blank"
								rel="noopener noreferrer"
								className="text-accent no-underline hover:underline"
							>
								Open an issue on GitHub.
							</a>
						</p>
					</motion.div>

					{/* Q&A */}
					<div className="mx-auto w-full max-w-[760px]">
						{faqs.map((faq, i) => (
							<motion.div
								key={faq.q}
								initial={{ opacity: 0, y: 16 }}
								animate={inView ? { opacity: 1, y: 0 } : {}}
								transition={{ duration: 0.4, delay: i * 0.07 }}
								className={`pb-8 mb-8 text-center ${i < faqs.length - 1 ? "border-b border-border" : ""}`}
							>
								<h3 className="mb-3 text-lg font-semibold tracking-tight text-primary">{faq.q}</h3>
								<p className="mx-auto max-w-[42rem] text-center text-[15px] leading-7 text-secondary">{faq.a}</p>
							</motion.div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
