import os
import base64
import io
from typing import Dict, Any
import PyPDF2
from docx import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

def process_document(file_data: Dict[str, Any]) -> str:
    """Process different types of documents and return their content."""
    try:
        # Extract file info
        file_type = file_data.get('type', '')
        file_name = file_data.get('name', '')
        content = file_data.get('content', '')
        
        # Remove data URL prefix if present
        if ',' in content and ';base64,' in content:
            content = content.split(',')[1]
          # Decode base64 content
        file_content = base64.b64decode(content)
        
        # Process based on file extension
        if file_name.lower().endswith('.pdf'):
            # Try standard extraction first
            result = process_pdf(file_content)
            
            # If standard extraction failed or returned an error message, try OCR
            if result.startswith(("Failed to extract", "Error processing PDF", "This PDF is encrypted")):
                print(f"Standard PDF extraction failed. Attempting OCR extraction for: {file_name}")
                ocr_result = process_pdf_with_ocr(file_content)
                
                # If OCR succeeded, use that result; otherwise return original error with OCR error
                if not ocr_result.startswith(("OCR processing failed", "OCR dependencies")):
                    return ocr_result
                else:
                    return f"{result}\n\nOCR attempt: {ocr_result}"
            return result
            
        elif file_name.lower().endswith(('.doc', '.docx')):
            return process_docx(file_content)
        elif file_name.lower().endswith(('.txt', '.md', '.csv', '.json')):
            return process_text(file_content)
        else:
            return f"Unsupported file type: {file_name}"
            
    except Exception as e:
        return f"Error processing document: {str(e)}"

def process_pdf(content: bytes) -> str:
    """Extract text from PDF content with multiple fallback methods."""
    text = ""
    errors = []
    
    # Method 1: PyPDF2 standard extraction
    try:
        pdf_file = io.BytesIO(content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        # Check if PDF is encrypted
        if pdf_reader.is_encrypted:
            return "This PDF is encrypted or password-protected. Please provide an unencrypted PDF."
        
        # Extract text from each page
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n\n"
                
        # If we got meaningful text, return it
        cleaned_text = text.strip()
        if cleaned_text and len(cleaned_text) > 100 and is_meaningful_text(cleaned_text):
            return cleaned_text
    except Exception as e:        errors.append(f"PyPDF2 extraction failed: {str(e)}")
    
    # Method 2: Try to extract text using layout analysis (if pdfminer.six is available)
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        pdf_file = io.BytesIO(content)
        text = pdfminer_extract(pdf_file)
        
        cleaned_text = text.strip()
        if cleaned_text and len(cleaned_text) > 100 and is_meaningful_text(cleaned_text):
            return cleaned_text
    except ImportError:
        errors.append("pdfminer.six not available, skipping layout-based extraction")
    except Exception as e:
        errors.append(f"PDFMiner extraction failed: {str(e)}")
    
    # Method 3: Try a raw extraction approach for problematic PDFs
    try:
        # Simple pattern-based approach to find text strings in the PDF
        decoded = content.decode('latin-1', errors='replace')
        
        # Look for potential text content by checking for readable sequences
        import re
        # Find strings that look like text (letters, spaces, punctuation) of reasonable length
        text_chunks = re.findall(r'[A-Za-z][A-Za-z\s\.,;:!\?\(\)\'"-]{10,}', decoded)
        
        if text_chunks:
            text = "\n".join(text_chunks)
            return text
    except Exception as e:
        errors.append(f"Raw extraction failed: {str(e)}")
    
    # If we reached here, all methods failed
    if text.strip():
        # We have some text, but it might be of poor quality
        return f"Warning: PDF extraction may be incomplete or unreliable.\n\n{text.strip()}"
    else:
        # Complete failure - detailed error for debugging
        return f"Failed to extract text from PDF. The PDF may be scanned images without OCR text, corrupt, or have security features that prevent extraction.\n\nErrors encountered:\n" + "\n".join(errors)

def process_pdf_with_ocr(content: bytes) -> str:
    """Extract text from PDFs using OCR for scanned documents."""
    try:
        import pytesseract
        from pdf2image import convert_from_bytes
        import tempfile
        
        # Convert PDF to images
        with tempfile.TemporaryDirectory() as path:
            images = convert_from_bytes(content, output_folder=path)
            
            # Process each page with OCR
            text = ""
            for i, image in enumerate(images):
                page_text = pytesseract.image_to_string(image)
                text += f"\n\n--- Page {i+1} ---\n\n" + page_text
            
            return text.strip()
    except ImportError:
        return "OCR dependencies (pytesseract, pdf2image) not installed. Install them for OCR capabilities."
    except Exception as e:
        return f"OCR processing failed: {str(e)}"
    
def process_docx(content: bytes) -> str:
    """Extract text from DOCX content."""
    try:
        doc_file = io.BytesIO(content)
        doc = Document(doc_file)
        text = ""
        
        for para in doc.paragraphs:
            text += para.text + "\n"
            
        return text.strip()
    except Exception as e:
        return f"Error processing DOCX: {str(e)}"

def process_text(content: bytes) -> str:
    """Process plain text content."""
    try:
        return content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            return content.decode('latin-1')
        except Exception as e:
            return f"Error decoding text: {str(e)}"

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    """Split text into manageable chunks."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len
    )
    return text_splitter.split_text(text)

def is_meaningful_text(text: str) -> bool:
    """
    Check if extracted text appears to be meaningful rather than binary or encoded data.
    
    Args:
        text: The text to analyze
        
    Returns:
        bool: True if text appears to be meaningful, False otherwise
    """
    if not text or len(text.strip()) < 10:
        return False
        
    # Count common characteristics of real text
    has_spaces = ' ' in text
    has_newlines = '\n' in text
    has_common_words = any(word in text.lower() for word in ['the', 'and', 'is', 'in', 'to', 'of'])
    has_sentences = '.' in text
    
    # Check the ratio of common symbols often found in binary/encoded data
    unusual_char_count = sum(1 for c in text if c in '%@^~{}[]<>|\\')
    unusual_char_ratio = unusual_char_count / len(text) if text else 1
    
    # Calculate ASCII ratio (readable text vs binary data)
    printable_chars = sum(1 for c in text if (32 <= ord(c) <= 126 or c in '\n\t\r '))
    printable_ratio = printable_chars / len(text) if text else 0
    
    # Real text should:
    # 1. Have spaces and newlines
    # 2. Contain common English words
    # 3. Have a high ratio of printable characters
    # 4. Have a low ratio of unusual symbols
    # 5. Contain sentences (periods)
    return (has_spaces and has_newlines and has_common_words and 
            printable_ratio > 0.9 and unusual_char_ratio < 0.05 and has_sentences)
