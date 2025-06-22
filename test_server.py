import base64
import requests
import sys
import os
import json
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("TestClient")

def test_server_health():
    """Test the server's health check endpoint."""
    try:
        response = requests.get("http://localhost:5000/health")
        if response.status_code == 200:
            logger.info("✅ Server health check passed!")
            return True
        else:
            logger.error(f"❌ Server health check failed! Status code: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        logger.error("❌ Could not connect to server! Make sure the server is running.")
        return False

def process_document(file_path):
    """Process a document file using the server API."""
    if not os.path.exists(file_path):
        logger.error(f"File does not exist: {file_path}")
        return None
    
    # Read file and convert to base64
    with open(file_path, 'rb') as file:
        file_content = file.read()
        
    file_name = os.path.basename(file_path)
    file_type = "application/pdf" if file_name.lower().endswith('.pdf') else "application/msword"
    
    # Convert to base64 with data URL format
    base64_content = base64.b64encode(file_content).decode('utf-8')
    
    # Prepare request
    payload = {
        "name": file_name,
        "type": file_type,
        "content": base64_content
    }
    
    logger.info(f"Processing document: {file_name}")
    
    # Send request to server
    try:
        response = requests.post(
            "http://localhost:5000/process-document",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                text_length = len(result.get("text", ""))
                logger.info(f"✅ Server successfully processed document. Extracted text length: {text_length} chars")
                
                # Preview the first 200 characters
                preview = result.get("text", "")[:200] + "..." if text_length > 200 else result.get("text", "")
                logger.info(f"Text preview: {preview}")
                return result
            else:
                logger.error(f"❌ Server processing failed: {result.get('error')}")
                return None
        else:
            logger.error(f"❌ Server returned error status: {response.status_code}")
            logger.error(response.text)
            return None
    except requests.exceptions.ConnectionError:
        logger.error("❌ Could not connect to server! Make sure the server is running.")
        return None
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        return None

if __name__ == "__main__":
    # Check if server is running first
    if not test_server_health():
        logger.info("Please start the server first with: python server.py")
        sys.exit(1)
    
    # Check if a file path was provided
    if len(sys.argv) < 2:
        logger.info("Usage: python test_server.py <path_to_pdf_or_doc_file>")
        sys.exit(1)
    
    # Process the document
    file_path = sys.argv[1]
    result = process_document(file_path)
    
    if result:
        # Save the extracted text to a file for inspection
        output_file = f"{os.path.splitext(os.path.basename(file_path))[0]}_extracted.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(result.get("text", ""))
        logger.info(f"Saved extracted text to: {output_file}")
