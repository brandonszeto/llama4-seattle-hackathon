import React from "react";

function Summary({ steps }) {
  return (
    <div className="summary">
      <h2>Summary of Steps</h2>
      <ol>
        {steps.map((step, idx) => (
          <li key={idx}>{step.text || "Step description"}</li>
        ))}
      </ol>
      <p>All steps completed!</p>
    </div>
  );
}

export default Summary;
