from flask import Flask, request, jsonify
from flask_cors import CORS
from document_processor import process_document
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("pdf_server.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all domains on all routes

@app.route('/process-document', methods=['POST'])
def handle_document():
    """
    API endpoint to process document files.
    Expects a JSON with file data in base64 format.
    
    Example request body:
    {
        "name": "example.pdf",
        "type": "application/pdf",
        "content": "base64encodedcontent..."
    }
    """
    try:
        if not request.is_json:
            logger.error("Request is not JSON")
            return jsonify({"error": "Request must be JSON"}), 400
        
        data = request.json
        
        # Check for required fields
        if not all(key in data for key in ['name', 'type', 'content']):
            logger.error("Missing required fields in request")
            return jsonify({"error": "Missing required fields: name, type, content"}), 400
        
        # Log processing attempt
        logger.info(f"Processing document: {data['name']} ({data['type']})")
        
        # Process the document using our document_processor.py
        result = process_document(data)
        
        # Log success and return result
        logger.info(f"Successfully processed document: {data['name']} - Content length: {len(result) if result else 0}")
        return jsonify({
            "success": True,
            "text": result,
            "fileName": data['name']
        })
        
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}", exc_info=True)
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint."""
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    logger.info("Starting PDF processing server on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
