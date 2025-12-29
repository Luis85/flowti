import { MessageTemplate } from "src/messages/types";
import { defaultTimeOfDayFactor } from "src/simulation/utils";

/**
 * Make sure every template has a unique id.
 */
export const DAILY_MESSAGES_CATALOG: MessageTemplate[] = [
  // --- Spam
  {
    id: "spam-tools-01",
    type: "Spam",
    subject: "Please buy your tools from us",
    body: "Here is a lengthy description why you really should buy your tools from us! A once-in-a-lifetime opportunity… (it's clearly suspicious). Review and decide.",
    author: "Max Musterman",
    priority: "3 - Low",
    possible_actions: ["read", "delete", "spam", "accept"],
    weight: 6,
    tags: ["junk"],
    soft: {
      // spam can happen anytime, but slightly more during work hours
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
      weekendFactor: (w) => (w ? 0.8 : 1.0),
    },
  },
  {
    id: "spam-crypto-01",
    type: "Spam",
    subject: "You have been selected for a special investment",
    body: "A once-in-a-lifetime opportunity… (it's clearly suspicious).",
    author: "Unknown Sender",
    priority: "3 - Low",
    possible_actions: ["read", "delete", "spam", "accept"],
    weight: 5,
    tags: ["junk"],
    soft: {
      // spam can happen anytime, but slightly more during work hours
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
      weekendFactor: (w) => (w ? 0.8 : 1.0),
    },
  },

  // --- Support
  {
    id: "support-tyre-01",
    type: "SupportRequest",
    subject: "Tyre order status unclear",
    body: "We need an update on the tyre delivery for the upcoming session.",
    author: "Logistics Desk",
    priority: "2 - Medium",
    possible_actions: ["read", "delete", "accept", "decline", "spam"],
    weight: 3,
    tags: ["logistics", "support", "spam"],
    soft: {
      timeOfDayFactor: (m) => (m < 360 ? 0.2 : m < 540 ? 0.7 : 1.0), // less at night
      weekendFactor: (w) => (w ? 0.6 : 1.0),
    },
  },

  // --- Complain
  {
    id: "complain-fan-01",
    type: "Complain",
    subject: "Merch delivery delayed",
    body: "A fan complains about late delivery and asks for a refund.",
    author: "Customer Support",
    priority: "2 - Medium",
    possible_actions: ["read", "decline", "delete", "spam", "respond", "accept"],
    weight: 2,
    tags: ["customer", "risk", "spam"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 0.8,
      weekendFactor: (w) => (w ? 0.7 : 1.0),
    },
  },

  // --- Opportunity
  {
    id: "opp-sponsor-01",
    type: "Opportunity",
    subject: "Sponsor intro: interested in a call",
    body: "A brand reached out about a sponsorship opportunity. Review and decide.",
    author: "Commercial Team",
    priority: "1 - High",
    possible_actions: ["read", "delete", "accept", "decline", "spam"],
    weight: 0.4,
    tags: ["sponsor", "deal"],
    soft: {
      // mostly during business hours, but can still happen in off-hours
      timeOfDayFactor: (m) => (m < 360 ? 0.15 : m < 540 ? 0.6 : m < 1020 ? 1.2 : 0.5),
      weekendFactor: (w) => (w ? 0.5 : 1.0),
    },
  },
  //learning opportunities are the entry point to learn or improve skills
  {
    id: "opp-learning-01",
    type: "Opportunity",
    subject: "Learning Opportunity: interested in a call",
    body: "A industry veteran reached out about a learning opportunity. Review and decide.",
    author: "Unknown Sender",
    priority: "2 - Medium",
    possible_actions: ["read", "delete", "accept", "decline", "spam"],
    weight: 0.4,
    tags: ["learning", "growth", "personal"],
    soft: {
      // mostly during business hours, but can still happen in off-hours
      timeOfDayFactor: (m) => (m < 360 ? 0.15 : m < 540 ? 0.6 : m < 1020 ? 1.2 : 0.5),
      weekendFactor: (w) => (w ? 0.5 : 1.0),
    },
  },

  // --- RFQ / RFP
  {
    id: "rfq-parts-01",
    type: "RFQ",
    subject: "RFQ: Carbon fiber parts pricing",
    body: "Supplier asks for confirmation on requested quantities and delivery windows.",
    author: "Supplier Sales",
    priority: "2 - Medium",
    possible_actions: ["read", "delete", "accept", "decline", "spam"],
    weight: 1.2,
    tags: ["procurement", "supplier"],
    soft: {
      timeOfDayFactor: (m) => (m < 360 ? 0.12 : m < 540 ? 0.6 : 1.0),
      weekendFactor: (w) => (w ? 0.4 : 1.0),
    },
  },
  {
    id: "rfp-service-01",
    type: "RFP",
    subject: "RFP: Professional Service",
    body: "Supplier asks for confirmation on requested quantities and delivery windows.",
    author: "Sales",
    priority: "1 - High",
    possible_actions: ["read", "delete", "accept", "decline", "spam"],
    weight: 1.5,
    tags: ["sales"],
    soft: {
      timeOfDayFactor: (m) => (m < 360 ? 0.12 : m < 540 ? 0.6 : 1.0),
      weekendFactor: (w) => (w ? 0.4 : 1.0),
    },
  },

  // --- Order Cancellation
  {
    id: "cancel-order-01",
    type: "OrderCancelation",
    subject: "Order cancellation requested",
    body: "A customer requests to cancel their order. Decide how to proceed.",
    author: "Sales Ops",
    priority: "0 - Urgent",
    possible_actions: ["read", "delete", "accept", "decline", "spam"],
    weight: 0.6,
    tags: ["sales", "risk"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 0.9,
      weekendFactor: (w) => (w ? 0.6 : 1.0),
    },
  },

  // --- Phishing
  {
    id: "phish-try-01",
    type: "Phishing",
    subject: "Order cancellation requested",
    body: "A customer requests to cancel their order. Please Contact him now, he has forgotten his password, please laos provide it to him. Decide how to proceed.",
    author: "Sales Ops",
    priority: "0 - Urgent",
    possible_actions: ["read", "delete", "accept", "decline", "spam", "inspect"],
    weight: 0.9,
    tags: ["sales"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
      weekendFactor: (w) => (w ? 0.2 : 1.0),
    },
  },

  // --- Offers
  {
    id: "offer-try-01",
    type: "Offer",
    subject: "Go get my car for a smll buck",
    body: "Yo, you want to buy my car for 200 Monies?",
    author: "Sales Ops",
    priority: "2 - Medium",
    possible_actions: ["read", "delete", "accept", "decline", "spam", "inspect"],
    weight: 0.3,
    tags: ["personal"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
      weekendFactor: (w) => (w ? 0.8 : 0.4),
    },
  },

  // --- Generic Requests
  {
    id: "gen-req-01",
    type: "GenericRequest",
    subject: "You can help?",
    body: "Hi, I have this very specific problem and I need someone to help me fix it. You available?",
    author: "Sales Ops",
    priority: "3 - Low",
    possible_actions: ["read", "delete", "accept", "decline", "spam", "inspect"],
    weight: 0.4,
    tags: [],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
      weekendFactor: (w) => (w ? 0.2 : 1.4),
    },
  },
];
