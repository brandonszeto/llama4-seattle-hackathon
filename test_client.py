import requests
import base64
import sys
import os

def encode_file(file_path):
    """Encode a file to base64"""
    with open(file_path, 'rb') as file:
        file_content = file.read()
        encoded = base64.b64encode(file_content).decode('utf-8')
    return encoded

def send_to_server(file_path, server_url="http://localhost:5000/process-document"):
    """Send a file to the processing server"""
    # Get file details
    file_name = os.path.basename(file_path)
    file_ext = os.path.splitext(file_name)[1].lower()
    
    # Determine content type
    content_types = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.txt': 'text/plain'
    }
    content_type = content_types.get(file_ext, 'application/octet-stream')
    
    # Encode the file
    encoded_content = encode_file(file_path)
    
    # Build the request
    payload = {
        "name": file_name,
        "type": content_type,
        "content": encoded_content
    }
    
    # Send to server
    print(f"Sending {file_name} to server for processing...")
    response = requests.post(server_url, json=payload)
    
    if response.status_code == 200:
        result = response.json()
        print(f"Success! Extracted {len(result['text'])} characters of text.")
        
        # Save the extracted text to a file
        output_file = f"{os.path.splitext(file_name)[0]}_extracted.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result['text'])
        print(f"Extracted text saved to {output_file}")
        
        return result['text']
    else:
        print(f"Error: Server returned status code {response.status_code}")
        print(response.text)
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_client.py <path_to_pdf_file>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    send_to_server(file_path)
