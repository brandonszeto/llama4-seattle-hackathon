# Meta Assistant with Document Processing

This project is a Chrome extension that allows users to capture a screenshot of the current tab, upload documents (PDF, DOCX, TXT), and ask questions to the Llama API about both the screen content and the document context.

## Features

- **Screen Capture**: Capture the current tab and send it to Llama API for analysis.
- **Document Context**: Upload PDF or DOCX documents to provide additional context.
- **Server-side Document Processing**: Reliable extraction of text from documents using multiple methods.
- **Robust PDF Extraction**: Multiple extraction algorithms including OCR for scanned documents.
- **Fallback Mechanisms**: Client-side extraction when server isn't available.

## Setup Instructions

### Server Setup

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the document processing server:
   ```bash
   python server.py
   ```

   The server will start on http://localhost:5000 and handle document processing requests.

### Testing the Server

To test that the server is working correctly:

```bash
python test_server.py path/to/your/document.pdf
```

This script will:
1. Check if the server is running
2. Send the specified document to the server for processing
3. Save the extracted text to a file for inspection

### Chrome Extension Setup

1. In Chrome, go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right)
3. Click "Load unpacked" and select the `chrome_extension` folder
4. Set your Llama API key in `sidebar.js` (look for `const apiKey = "YOUR_LLAMA_API_KEY"`)

## Using the Extension

1. Click the extension icon in your Chrome toolbar to open the Meta Assistant sidebar
2. To add document context:
   - Click "Add Context" 
   - Select a PDF or DOCX file
   - Wait for the processing to complete
   - (Optional) Click "Show Extracted Text" to verify the content
3. Type your question in the input field and click "Capture & Ask Meta"
4. The assistant will respond using both the screen capture and document context

## How Document Processing Works

The document processing pipeline works in multiple stages:

1. **Server-side Processing** (Primary Method):
   - Document is sent to the Python backend server
   - Multiple extraction methods are used (PyPDF2, pdfminer.six, etc.)
   - OCR is used for scanned documents (requires Tesseract)
   - Quality checks ensure the extracted text is meaningful

2. **Client-side Fallback** (If Server Fails):
   - Multiple browser-based extraction methods are attempted
   - PDF.js library and direct extraction techniques are used
   - Quality checks filter out binary/encoded data

## Troubleshooting

- **Server Connection Issues**: Ensure the server is running on port 5000 and accessible
- **PDF Extraction Problems**: Some PDFs may be encrypted or contain only images
- **CORS Issues**: The extension should have proper permissions, but check browser console for errors
- **Performance**: Large documents may take time to process

## Developing and Extending

- The server API endpoint is `/process-document` accepting POST requests
- The server supports health checks via GET to `/health`
- The document processor can be extended with new extraction methods
