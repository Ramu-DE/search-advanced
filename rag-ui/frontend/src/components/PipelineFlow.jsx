import React from "react";
import { motion } from "framer-motion";

const COLORS = {
  indigo: "from-indigo-500 to-indigo-600",
  cyan: "from-cyan-500 to-cyan-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
};

const BORDER = {
  indigo: "border-indigo-500/40",
  cyan: "border-cyan-500/40",
  emerald: "border-emerald-500/40",
  amber: "border-amber-500/40",
  rose: "border-rose-500/40",
};

const TEXT = {
  indigo: "text-indigo-400",
  cyan: "text-cyan-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
};

export default function PipelineFlow({ steps, activeStep, completedSteps }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-3 hidden md:flex items-center justify-center gap-2">
      {steps.map((step, idx) => {
        const isActive = activeStep === step.id;
        const isDone = completedSteps.has(step.id);

        return (
          <React.Fragment key={step.id}>
            <motion.div
              animate={{ scale: isActive ? 1.05 : 1 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-300
                ${isActive
                  ? `bg-gradient-to-r ${COLORS[step.color]} text-white border-transparent shadow-lg`
                  : isDone
                  ? `bg-dark-700 ${BORDER[step.color]} ${TEXT[step.color]}`
                  : "bg-dark-800 border-white/10 text-slate-500"
                }`}
            >
              <span className="text-base">{isDone && !isActive ? "✅" : step.icon}</span>
              <span className="hidden lg:inline">{step.label}</span>
            </motion.div>

            {idx < steps.length - 1 && (
              <div className="flex items-center">
                <motion.div
                  animate={{
                    backgroundColor: completedSteps.has(step.id)
                      ? "#6366f1"
                      : "rgba(255,255,255,0.1)",
                  }}
                  transition={{ duration: 0.5 }}
                  className="h-px w-8 rounded"
                />
                <div
                  className={`w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent transition-all duration-500 ${
                    completedSteps.has(step.id)
                      ? "border-l-indigo-500"
                      : "border-l-white/10"
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
