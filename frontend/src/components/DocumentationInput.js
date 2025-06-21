import React, { useState } from "react";

function DocumentationInput({ onSubmit }) {
  const [link, setLink] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (link) onSubmit(link);
  };

  return (
    <form onSubmit={handleSubmit} className="doc-input-form">
      <input
        type="url"
        placeholder="Paste documentation link here..."
        value={link}
        onChange={(e) => setLink(e.target.value)}
        className="doc-input"
        required
      />
      <button type="submit" className="doc-submit-btn">Load</button>
    </form>
  );
}

export default DocumentationInput;
