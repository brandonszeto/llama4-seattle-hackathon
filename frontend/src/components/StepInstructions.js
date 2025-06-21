import React from "react";

function StepInstructions({ step, onComplete }) {
  // Placeholder for TTS and ASR integration
  if (!step) return <p>No instructions yet.</p>;
  return (
    <div className="step-instructions">
      <h2>Step Instruction</h2>
      <div className="instruction-content">
        <p>{step.text || "Instruction will appear here."}</p>
        {/* Placeholder for screenshot display */}
        {step.screenshot && <img src={step.screenshot} alt="Step Screenshot" className="step-screenshot" />}
      </div>
      <button onClick={onComplete} className="complete-step-btn">✔️ Mark Step Complete</button>
    </div>
  );
}

export default StepInstructions;
