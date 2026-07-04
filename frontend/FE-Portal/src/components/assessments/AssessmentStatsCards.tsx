import React from "react";
import { Users, CircleCheckBig, Clock, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { AssessmentStats, ModalType } from "./AssessmentDetailsTypes";

interface AssessmentStatsCardsProps {
  stats: AssessmentStats;
  onOpenModal: (type: ModalType, count: number) => void;
}

export const AssessmentStatsCards: React.FC<AssessmentStatsCardsProps> = ({ stats, onOpenModal }) => {
  const cards = [
    {
      label: "Total Assigned",
      value: stats.totalAssigned,
      icon: Users,
      gradient: "from-brand-purple to-brand-violet",
      type: "all" as ModalType,
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CircleCheckBig,
      gradient: "from-[#0e9f6e] to-[#23c366]",
      type: "completed" as ModalType,
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      gradient: "from-[#c2790b] to-[#eab40b]",
      type: "inProgress" as ModalType,
    },
    {
      label: "Expired",
      value: stats.expired,
      icon: AlertCircle,
      gradient: "from-[#d64545] to-[#ef6262]",
      type: "expired" as ModalType,
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <StatCard
          key={card.label}
          index={i}
          compact
          label={card.label}
          value={card.value}
          icon={card.icon}
          gradient={card.gradient}
          onClick={card.value > 0 ? () => onOpenModal(card.type, card.value) : undefined}
        />
      ))}
    </div>
  );
};
