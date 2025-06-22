import base64
import requests
import os
import logging
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("EndToEndTest")

def test_server_health():
    """Test the server's health check endpoint."""
    try:
        response = requests.get("http://localhost:5000/health")
        return response.status_code == 200
    except:
        return False

def process_sample_document():
    """Process a sample document to test the server."""
    # Create a sample text file if none exists
    sample_file = "sample_test.txt"
    if not os.path.exists(sample_file):
        with open(sample_file, "w") as f:
            f.write("This is a sample test document.\n")
            f.write("It is used to verify that the document processing server works correctly.\n")
            f.write("If you can see this text in the Chrome extension, the server is working properly!")
    
    # Read the sample file
    with open(sample_file, 'rb') as file:
        file_content = file.read()
    
    # Convert to base64
    base64_content = base64.b64encode(file_content).decode('utf-8')
    
    # Prepare request
    payload = {
        "name": sample_file,
        "type": "text/plain",
        "content": base64_content
    }
    
    # Send request to server
    try:
        response = requests.post(
            "http://localhost:5000/process-document",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get("success", False), result.get("text", "")
        else:
            return False, f"Error: {response.status_code}"
    except Exception as e:
        return False, str(e)

def serve_test_page():
    """Start a simple HTTP server to serve the test page."""
    # Create a simple test HTML page
    test_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Document Processing Test</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #1a73e8; }
            .instructions { background: #f1f1f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .step { margin-bottom: 10px; }
            code { background: #e0e0e0; padding: 2px 4px; border-radius: 3px; }
            .success { color: #0d904f; }
            .failure { color: #d93025; }
        </style>
    </head>
    <body>
        <h1>Document Processing Test Page</h1>
        
        <div class="instructions">
            <h2>Instructions to Test the Chrome Extension with Server</h2>
            
            <div class="step">1. Make sure the document processing server is running.</div>
            <div class="step">2. Open the Meta Assistant Chrome extension on this page.</div>
            <div class="step">3. Click "Add Context" in the extension sidebar.</div>
            <div class="step">4. Upload a PDF or other document file.</div>
            <div class="step">5. If the server is working, you should see the extracted text appear.</div>
            <div class="step">6. Click "Show Extracted Text" to verify the content was properly extracted.</div>
        </div>
        
        <div id="server-status">
            Checking server status...
        </div>
        
        <script>
            // Check if the server is running
            fetch('http://localhost:5000/health')
                .then(response => {
                    if (response.ok) {
                        document.getElementById('server-status').innerHTML = 
                            '<p class="success">✓ Server is running and healthy!</p>'
                    } else {
                        document.getElementById('server-status').innerHTML = 
                            '<p class="failure">✗ Server returned an error. Check the console for details.</p>'
                    }
                })
                .catch(error => {
                    document.getElementById('server-status').innerHTML = 
                        '<p class="failure">✗ Could not connect to server at http://localhost:5000. Make sure it\'s running.</p>'
                });
        </script>
    </body>
    </html>
    """
    
    # Write the test page
    with open("test_page.html", "w") as f:
        f.write(test_html)
    
    # Serve the test page
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=".", **kwargs)
            
        def log_message(self, format, *args):
            # Suppress log messages
            pass
    
    port = 8000
    httpd = HTTPServer(('localhost', port), Handler)
    
    # Start the server in a separate thread
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    return port

if __name__ == "__main__":
    logger.info("=== Chrome Extension Server Connection Test ===")
    
    # Check if server is running
    if not test_server_health():
        logger.error("❌ Server is not running! Please start it with: python server.py")
        logger.info("Starting server for you...")
        
        # Try to start the server
        import subprocess
        import sys
        try:
            process = subprocess.Popen([sys.executable, "server.py"], 
                                     stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE)
            # Give the server time to start
            time.sleep(3)
            
            if not test_server_health():
                logger.error("❌ Failed to start server. Please start it manually.")
                exit(1)
            else:
                logger.info("✅ Server started successfully!")
        except Exception as e:
            logger.error(f"❌ Error starting server: {str(e)}")
            exit(1)
    else:
        logger.info("✅ Server is running!")
    
    # Test processing a sample document
    logger.info("Testing document processing...")
    success, text = process_sample_document()
    
    if success:
        logger.info(f"✅ Successfully processed document! Preview: {text[:100]}...")
    else:
        logger.error(f"❌ Failed to process document: {text}")
    
    # Start a test web server and open the page
    port = serve_test_page()
    test_url = f"http://localhost:{port}/test_page.html"
    
    logger.info(f"\n✅ Test environment ready! Opening test page in browser...")
    logger.info(f"🌐 Test page URL: {test_url}")
    logger.info("Please follow the instructions on the test page.")
    
    # Open the test page
    webbrowser.open(test_url)
    
    logger.info("\nPress Ctrl+C to stop the test server when finished.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Test server stopped.")
