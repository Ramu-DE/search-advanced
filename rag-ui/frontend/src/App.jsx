import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "./components/Header.jsx";
import PipelineNav from "./components/PipelineNav.jsx";
import UploadStep from "./components/UploadStep.jsx";
import ChunkingStep from "./components/ChunkingStep.jsx";
import EmbeddingStep from "./components/EmbeddingStep.jsx";
import RetrievalStep from "./components/RetrievalStep.jsx";
import GenerationStep from "./components/GenerationStep.jsx";
import PipelineFlow from "./components/PipelineFlow.jsx";

const STEPS = [
  { id: "upload", label: "Upload", icon: "📄", color: "indigo" },
  { id: "chunk", label: "Chunking", icon: "✂️", color: "cyan" },
  { id: "embed", label: "Embedding", icon: "🔢", color: "emerald" },
  { id: "retrieve", label: "Retrieval", icon: "🔍", color: "amber" },
  { id: "generate", label: "Generation", icon: "✨", color: "rose" },
];

export default function App() {
  const [activeStep, setActiveStep] = useState("upload");
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [ragState, setRagState] = useState({
    sessionId: null,
    filename: null,
    chunks: [],
    chunkingStats: null,
    embeddings: [],
    similarityMatrix: null,
    retrievalResults: null,
    generatedText: "",
    query: "",
  });

  const markComplete = (stepId) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
  };

  const updateState = (updates) => {
    setRagState((prev) => ({ ...prev, ...updates }));
  };

  const goToStep = (stepId) => {
    setActiveStep(stepId);
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100">
      <Header />

      {/* Pipeline flow diagram - always visible */}
      <div className="sticky top-0 z-40 bg-dark-950/95 backdrop-blur border-b border-white/5">
        <PipelineFlow steps={STEPS} activeStep={activeStep} completedSteps={completedSteps} />
        <PipelineNav
          steps={STEPS}
          activeStep={activeStep}
          completedSteps={completedSteps}
          onSelect={goToStep}
        />
      </div>

      {/* Step content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeStep === "upload" && (
              <UploadStep
                ragState={ragState}
                onComplete={(data) => {
                  updateState(data);
                  markComplete("upload");
                  goToStep("chunk");
                }}
              />
            )}
            {activeStep === "chunk" && (
              <ChunkingStep
                ragState={ragState}
                onComplete={() => {
                  markComplete("chunk");
                  goToStep("embed");
                }}
                onBack={() => goToStep("upload")}
              />
            )}
            {activeStep === "embed" && (
              <EmbeddingStep
                ragState={ragState}
                onComplete={(data) => {
                  updateState(data);
                  markComplete("embed");
                  goToStep("retrieve");
                }}
                onBack={() => goToStep("chunk")}
              />
            )}
            {activeStep === "retrieve" && (
              <RetrievalStep
                ragState={ragState}
                onComplete={(data) => {
                  updateState(data);
                  markComplete("retrieve");
                  goToStep("generate");
                }}
                onBack={() => goToStep("embed")}
              />
            )}
            {activeStep === "generate" && (
              <GenerationStep
                ragState={ragState}
                onUpdate={updateState}
                onBack={() => goToStep("retrieve")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
