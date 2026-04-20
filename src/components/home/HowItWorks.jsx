import React from "react";
import { motion } from "framer-motion";
import { UserPlus, Search, Bell, MessageSquare, KeyRound } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      icon: UserPlus,
      title: "Create Your Profile",
      description: "Sign up and complete your lifestyle profile.",
    },
    {
      icon: Search,
      title: "Save Your Search",
      description: "Create saved searches with your preferences.",
    },
    {
      icon: Bell,
      title: "Get Notified Instantly",
      description: "Receive real-time alerts for matching listings.",
    },
    {
      icon: MessageSquare,
      title: "Connect & Agree",
      description: "Message securely and use our agreement generator.",
    },
    {
      icon: KeyRound,
      title: "Move In",
      description: "Pay rent securely and start your new chapter.",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-4">
        How MiNest Works
      </h2>
      <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
        Five simple steps to finding your perfect match and moving in.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              viewport={{ once: true, margin: "0px 0px -50px 0px" }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 10 }}
                className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 mx-auto mb-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <motion.div
                  whileHover={{ rotate: 12, scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Icon className="w-8 h-8 text-accent" />
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.1 + 0.2 }}
                viewport={{ once: true }}
              >
                <div className="text-xs font-bold text-accent mb-2 uppercase tracking-wider">Step {i + 1}</div>
                <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}