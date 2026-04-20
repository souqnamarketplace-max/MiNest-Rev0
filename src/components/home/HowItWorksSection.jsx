import React from "react";
import { motion } from "framer-motion";
import { UserPlus, Search, Bell, MessageSquare, KeyRound } from "lucide-react";

const steps = [
  { icon: UserPlus, title: "Create Your Profile", desc: "Sign up, choose your intent (seeker, lister, or both), and complete your lifestyle profile." },
  { icon: Search, title: "Save Your Search", desc: "Create saved searches with your preferences. Get instant or daily alerts for new matches." },
  { icon: Bell, title: "Get Notified Instantly", desc: "Receive real-time notifications when listings or roommates match your criteria." },
  { icon: MessageSquare, title: "Connect & Agree", desc: "Message matches securely. Use our free roommate agreement generator to formalize terms." },
  { icon: KeyRound, title: "Move In", desc: "Pay rent securely in-app and start your new chapter with confidence." },
];

export default function HowItWorksSection() {
  return (
    <section className="py-20 md:py-28 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            How MiNest Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Five simple steps to finding your perfect match and moving in.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: "easeOut" }}
              viewport={{ once: true, margin: "0px 0px -100px 0px" }}
              className="relative text-center"
            >
              {i < steps.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ duration: 0.8, delay: i * 0.15 + 0.3, ease: "easeOut" }}
                  viewport={{ once: true }}
                  className="hidden md:block absolute top-12 left-1/2 w-full h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent origin-left"
                />
              )}
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 10 }}
                className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mx-auto mb-4 shadow-sm hover:shadow-lg transition-shadow"
              >
                <motion.div
                  whileHover={{ rotate: 12, scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <step.icon className="w-7 h-7 text-accent" />
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.12 + 0.3 }}
                viewport={{ once: true }}
              >
                <div className="text-xs font-bold text-accent mb-2 uppercase tracking-wider">Step {i + 1}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}