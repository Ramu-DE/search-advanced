import React from "react";
import { motion } from "framer-motion";

const COLOR_ACTIVE = {
  indigo: "text-indigo-400 border-indigo-400",
  cyan: "text-cyan-400 border-cyan-400",
  emerald: "text-emerald-400 border-emerald-400",
  amber: "text-amber-400 border-amber-400",
  rose: "text-rose-400 border-rose-400",
};

export default function PipelineNav({ steps, activeStep, completedSteps, onSelect }) {
  return (
    <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-0 scrollbar-none">
      {steps.map((step) => {
        const isActive = activeStep === step.id;
        const isDone = completedSteps.has(step.id);
        const isAccessible = isDone || step.id === "upload" || completedSteps.has(steps[steps.indexOf(step) - 1]?.id);

        return (
          <button
            key={step.id}
            onClick={() => isAccessible && onSelect(step.id)}
            disabled={!isAccessible}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap
              ${isActive
                ? `${COLOR_ACTIVE[step.color]} bg-white/5`
                : isDone
                ? "text-slate-400 border-transparent hover:text-slate-200 hover:border-white/20 cursor-pointer"
                : "text-slate-600 border-transparent cursor-not-allowed"
              }`}
          >
            <span>{step.icon}</span>
            <span>{step.label}</span>
            {isDone && !isActive && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
