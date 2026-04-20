import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Users, Plus, ArrowRight } from "lucide-react";

export default function ActionCards() {
  const cards = [
    {
      icon: Home,
      title: "Looking for a Room?",
      description: "Browse verified rooms across Canada and the USA. Filter by price, location, and lifestyle.",
      button: "Browse Rooms",
      href: "/search",
      featured: false,
    },
    {
      icon: Users,
      title: "Looking for a Roommate?",
      description: "Find people looking for rooms and match based on lifestyle, budget, and preferences.",
      button: "Find Roommates",
      href: "/roommates",
      featured: true,
    },
    {
      icon: Plus,
      title: "Have a Room to Rent?",
      description: "List your room in minutes and connect with qualified renters faster.",
      button: "Post a Room",
      href: "/create-listing",
      featured: false,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 block">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className={`rounded-2xl p-6 sm:p-8 border-2 transition-all ${
                card.featured
                  ? "border-accent bg-accent/5 shadow-lg"
                  : "border-border bg-card hover:border-accent/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg ${card.featured ? "bg-accent/10" : "bg-muted"}`}>
                  <Icon className={`w-6 h-6 ${card.featured ? "text-accent" : "text-foreground"}`} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{card.title}</h3>
              <p className="text-muted-foreground text-sm mb-6">{card.description}</p>
              <Link to={card.href}>
                <Button
                  variant={card.featured ? "default" : "outline"}
                  className="w-full group"
                >
                  {card.button}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}