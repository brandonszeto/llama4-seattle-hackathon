# Troubleshooting Guide

This guide covers common issues you might encounter when using the document processing server with the Chrome extension.

## Server Issues

### Server won't start

**Symptoms:** Error messages when running `python server.py` or `start_server.bat`

**Possible solutions:**
1. **Missing dependencies:** Run `pip install -r requirements.txt` again
2. **Port 5000 is already in use:**
   - Check what's using the port: `netstat -ano | findstr :5000`
   - Kill the process or change the port in server.py
3. **Python version compatibility:** Use Python 3.8+

### OCR isn't working

**Symptoms:** PDF files containing only scanned images aren't processed correctly

**Possible solutions:**
1. **Tesseract not installed:**
   - Install Tesseract OCR: [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
   - Add Tesseract to your PATH environment variable
2. **Packages missing:**
   - Make sure you've installed pdf2image: `pip install pdf2image`
   - Make sure you have Poppler tools installed (required by pdf2image)

## Chrome Extension Issues

### Can't connect to server

**Symptoms:** "Server processing failed" message when uploading a document

**Possible solutions:**
1. **Server not running:** Start the server with `python server.py`
2. **CORS issue:** Check that Flask-CORS is properly installed and configured in server.py
3. **Firewall blocking:** Allow Python/server through your firewall settings
4. **Network issue:** If running on different machines, make sure the server IP is accessible

### Extension not processing PDFs properly

**Symptoms:** Uploaded PDFs result in poor quality or no text extraction

**Possible solutions:**
1. **PDF is encrypted/protected:** Use an unprotected PDF
2. **PDF contains only images:** Make sure server-side OCR is working
3. **Unusual PDF encoding:** Try a different PDF file to check if it's a specific file issue

### Document size too large

**Symptoms:** Time-outs or browser hangs when uploading large documents

**Possible solutions:**
1. **Split the document:** Try uploading a smaller portion of the document
2. **Increase timeout:** Modify the fetch timeout in sidebar.js
3. **Save as optimized PDF:** Re-save the PDF with optimization settings

## Testing the Connection

1. Run `python test_connection.py` to test the full pipeline
2. This will:
   - Verify the server is running
   - Process a sample document
   - Open a test page in your browser
   - Allow you to test the Chrome extension with the server
