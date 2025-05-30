import os
import re
import hashlib
import requests
import json
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from werkzeug.utils import secure_filename
import google.generativeai as genai
import base64
import io
from PIL import Image

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure cache
cache_config = {
    "DEBUG": True,
    "CACHE_TYPE": "SimpleCache",  # Simple memory cache
    "CACHE_DEFAULT_TIMEOUT": 3600  # 1 hour (in seconds)
}
app.config.from_mapping(cache_config)
cache = Cache(app)

# Configure upload folder
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'html', 'css', 'js', 'txt'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Configure rate limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)

# Configure Gemini API settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# Initialize Gemini model
model = genai.GenerativeModel('gemini-1.5-flash')

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_image_file(filename):
    """Check if file is an image"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'gif'}

def allowed_code_file(filename):
    """Check if file is a code file"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'html', 'css', 'js', 'txt'}

@app.route('/')
def index():
    """Render the main page"""
    return render_template('index.html')

def get_cache_key(prompt, style, features, file_hash=None):
    """Generate a cache key from request parameters"""
    data = f"{prompt}|{style}|{features}|{file_hash or ''}"
    return hashlib.md5(data.encode()).hexdigest()

def extract_code_sections(generated_text):
    """Extract HTML, CSS, and JavaScript sections from the generated code"""
    html_code = ""
    css_code = ""
    js_code = ""
    
    # Extract code from the formatted sections
    html_match = re.search(r'```HTML\n([\s\S]*?)```', generated_text, re.IGNORECASE)
    css_match = re.search(r'```CSS\n([\s\S]*?)```', generated_text, re.IGNORECASE)
    js_match = re.search(r'```JS\n([\s\S]*?)```', generated_text, re.IGNORECASE)
    
    # Try alternative patterns
    if not html_match:
        html_match = re.search(r'```html\n([\s\S]*?)```', generated_text, re.IGNORECASE)
    if not css_match:
        css_match = re.search(r'```css\n([\s\S]*?)```', generated_text, re.IGNORECASE)
    if not js_match:
        js_match = re.search(r'```javascript\n([\s\S]*?)```', generated_text, re.IGNORECASE)
        if not js_match:
            js_match = re.search(r'```js\n([\s\S]*?)```', generated_text, re.IGNORECASE)
    
    if html_match:
        html_code = html_match.group(1).strip()
    if css_match:
        css_code = css_match.group(1).strip()
    if js_match:
        js_code = js_match.group(1).strip()
    
    # If we didn't get the expected format, try to extract from a complete HTML document
    if not (html_code and css_code):
        # Fallback to original extraction method
        complete_html = generated_text
        if "```html" in generated_text.lower() or "```" in generated_text:
            # Extract code from markdown code blocks
            code_match = re.search(r'```(?:html)?\n([\s\S]*?)```', generated_text, re.IGNORECASE)
            if code_match:
                complete_html = code_match.group(1)
        
        # Extract CSS
        css_pattern = re.compile(r'<style[^>]*>([\s\S]*?)<\/style>', re.IGNORECASE)
        css_match = css_pattern.search(complete_html)
        if css_match and not css_code:
            css_code = css_match.group(1).strip()
        
        # Extract JavaScript
        js_pattern = re.compile(r'<script[^>]*>([\s\S]*?)<\/script>', re.IGNORECASE)
        js_match = js_pattern.search(complete_html)
        if js_match and not js_code:
            js_code = js_match.group(1).strip()
        
        # Extract HTML (removing style and script tags)
        if not html_code:
            html_with_empty_tags = complete_html
            if css_match:
                html_with_empty_tags = html_with_empty_tags.replace(css_match.group(0), '')
            if js_match:
                html_with_empty_tags = html_with_empty_tags.replace(js_match.group(0), '')
            html_code = html_with_empty_tags
    
    # Reconstruct complete HTML for preview
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Webpage</title>
    <style>
    {css_code}
    </style>
</head>
<body>
    {html_code}
    <script>
    {js_code}
    </script>
</body>
</html>
    """
    
    return {
        "html": html_code,
        "css": css_code,
        "js": js_code,
        "full": full_html.strip()
    }

def read_uploaded_files(files):
    """Read and process uploaded code files"""
    file_contents = {}
    
    for file_key in files:
        if file_key in ['html_file', 'css_file', 'js_file']:
            file = files[file_key]
            if file and file.filename and allowed_code_file(file.filename):
                try:
                    content = file.read().decode('utf-8')
                    file_type = file_key.replace('_file', '')
                    file_contents[file_type] = content
                except Exception as e:
                    print(f"Error reading {file_key}: {str(e)}")
    
    return file_contents

def generate_with_gemini(prompt, image_path=None):
    """Generate content using Gemini API"""
    try:
        if image_path and allowed_image_file(image_path):
            # Load and process image
            image = Image.open(image_path)
            response = model.generate_content([prompt, image])
        else:
            response = model.generate_content(prompt)
        
        return response.text
    except Exception as e:
        print(f"Error calling Gemini API: {str(e)}")
        raise

@app.route('/api/generate', methods=['POST'])
@limiter.limit("10 per hour")
def generate_webpage():
    """Generate a webpage based on user input with advanced features"""
    try:
        # Initialize variables
        file_hash = None
        uploaded_image = None
        uploaded_files = {}
        prompt = ""
        style = "Modern & Clean"
        features = ""
        edit_mode = False
        
        # Handle file uploads if present
        if request.files:
            # Handle image upload
            if 'website_image' in request.files:
                file = request.files['website_image']
                if file and file.filename and allowed_image_file(file.filename):
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(file_path)
                    
                    # Create image hash for cache key
                    with open(file_path, 'rb') as f:
                        image_content = f.read()
                        file_hash = hashlib.md5(image_content).hexdigest()
                    
                    uploaded_image = file_path
            
            # Handle code file uploads
            uploaded_files = read_uploaded_files(request.files)
            if uploaded_files:
                edit_mode = True
                # Create hash from uploaded files
                files_content = ''.join(uploaded_files.values())
                file_hash = hashlib.md5(files_content.encode()).hexdigest()
            
            # Get form data
            prompt = request.form.get('prompt', '')
            style = request.form.get('pageStyle', 'Modern & Clean')
            features = request.form.get('features', '')
            edit_instructions = request.form.get('edit_instructions', '')
        
        # Handle JSON data if no files present
        elif request.is_json:
            data = request.json
            prompt = data.get('prompt', '')
            style = data.get('style', 'Modern & Clean')
            features = data.get('features', '')
            edit_instructions = data.get('edit_instructions', '')
        
        # Handle form data without file upload
        else:
            prompt = request.form.get('prompt', '')
            style = request.form.get('pageStyle', 'Modern & Clean')
            features = request.form.get('features', '')
            edit_instructions = request.form.get('edit_instructions', '')
            
        # Validate input
        if not prompt and not uploaded_image and not uploaded_files:
            return jsonify({"error": "Either a description, an image, or code files are required."}), 400
        
        # Generate cache key and check cache
        cache_key = get_cache_key(prompt + (edit_instructions if edit_mode else ''), style, features, file_hash)
        cached_result = cache.get(cache_key)
        
        if cached_result:
            code_sections = extract_code_sections(cached_result)
            return jsonify({
                "code": code_sections["full"],
                "html": code_sections["html"],
                "css": code_sections["css"],
                "js": code_sections["js"],
                "message": "Webpage retrieved from cache",
                "cached": True,
                "edit_mode": edit_mode
            })
        
        # Create appropriate prompt based on mode
        if edit_mode:
            # Edit mode - modify existing code
            full_prompt = f"""
            I have existing HTML, CSS, and JavaScript code that I want you to modify based on these instructions:
            
            EDIT INSTRUCTIONS: {edit_instructions if 'edit_instructions' in locals() else prompt}
            
            EXISTING CODE:
            """
            
            if 'html' in uploaded_files:
                full_prompt += f"\nHTML:\n{uploaded_files['html']}\n"
            if 'css' in uploaded_files:
                full_prompt += f"\nCSS:\n{uploaded_files['css']}\n"
            if 'js' in uploaded_files:
                full_prompt += f"\nJavaScript:\n{uploaded_files['js']}\n"
            
            full_prompt += f"""
            
            Style preferences: {style}
            Additional features to include: {features}
            
            Please modify the code according to the instructions and return the updated version.
            
            IMPORTANT: Return your response in this exact format:
            ```HTML
            <!-- Your updated HTML code here (without style or script tags) -->
            ```
            
            ```CSS
            /* Your updated CSS code here */
            ```
            
            ```JS
            // Your updated JavaScript code here
            ```
            
            Make sure to:
            - Keep the existing functionality unless specifically asked to change it
            - Improve the code structure and add comments where helpful
            - Ensure all modifications work together seamlessly
            - Maintain responsive design and accessibility features
            """
        else:
            # Generation mode - create new webpage
            full_prompt = f"""
            Create a complete, modern, and highly interactive webpage based on this description: "{prompt}".
            
            Style preferences: {style}
            Special features to include: {features}
            
            The output should be clearly separated into three distinct parts:
            1. HTML structure (without embedded style or script tags)
            2. CSS code (without the surrounding style tags)
            3. JavaScript code (without the surrounding script tags)
            
            IMPORTANT: Return your response in this exact format:
            ```HTML
            <!-- Your HTML code here (without style or script tags) -->
            ```
            
            ```CSS
            /* Your CSS code here */
            ```
            
            ```JS
            // Your JavaScript code here
            ```
            
            ADVANCED REQUIREMENTS:
            
            For HTML:
            - Use semantic HTML5 elements (header, footer, section, article, nav, aside, etc.)
            - Implement a proper document structure with meta tags for SEO and responsive design
            - Use modern HTML features like data attributes, custom attributes, SVG where appropriate
            - Add appropriate ARIA attributes for accessibility
            - Create a responsive layout structure
            
            For CSS:
            - Create modern, animated UI with clean aesthetics and attention to detail
            - Implement advanced CSS features: custom properties (variables), calc(), clamp(), gradients
            - Use CSS Grid and Flexbox for complex, responsive layouts
            - Include engaging animations and transitions (entrance animations, hover effects, etc.)
            - Implement smooth scrolling and other modern visual techniques
            - Add thoughtful media queries for full responsiveness (mobile, tablet, desktop)
            - Use keyframe animations for complex effects
            - Implement color theme consistency with CSS variables
            
            For JavaScript:
            - Create rich interactivity: dynamic content loading, form validation, UI state management
            - Use ES6+ features: arrow functions, template literals, destructuring, etc.
            - Create modular code with separate functions for different features
            - Add smooth animations controlled by JavaScript
            - Implement form validation with helpful user feedback
            - Create interactive UI elements like sliders, tabs, accordions, modals, etc.
            - Add proper error handling for user interactions
            - Use modern DOM APIs and manipulation techniques
            
            Make sure the entire solution works together seamlessly, with JS enhancing the UI created with HTML/CSS.
            """
        
        # Generate content with Gemini
        if uploaded_image:
            generated_text = generate_with_gemini(full_prompt, uploaded_image)
        else:
            generated_text = generate_with_gemini(full_prompt)
        
        # Extract and process code
        code_sections = extract_code_sections(generated_text)
        
        # Store in cache
        cache.set(cache_key, generated_text)
        
        return jsonify({
            "code": code_sections["full"],
            "html": code_sections["html"],
            "css": code_sections["css"],
            "js": code_sections["js"],
            "message": "Webpage generated successfully" if not edit_mode else "Code edited successfully",
            "edit_mode": edit_mode
        })
    
    except Exception as e:
        print(f"Error generating webpage: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/edit', methods=['POST'])
@limiter.limit("15 per hour")
def edit_code():
    """Edit existing HTML, CSS, and JS code"""
    try:
        data = request.json
        
        html_code = data.get('html', '')
        css_code = data.get('css', '')
        js_code = data.get('js', '')
        edit_instructions = data.get('instructions', '')
        
        if not edit_instructions:
            return jsonify({"error": "Edit instructions are required."}), 400
        
        if not (html_code or css_code or js_code):
            return jsonify({"error": "At least one code section (HTML, CSS, or JS) is required."}), 400
        
        # Create prompt for editing
        edit_prompt = f"""
        I have existing code that I want you to modify based on these instructions:
        
        EDIT INSTRUCTIONS: {edit_instructions}
        
        EXISTING CODE:
        HTML:
        {html_code}
        
        CSS:
        {css_code}
        
        JavaScript:
        {js_code}
        
        Please modify the code according to the instructions and return the updated version.
        
        IMPORTANT: Return your response in this exact format:
        ```HTML
        <!-- Your updated HTML code here -->
        ```
        
        ```CSS
        /* Your updated CSS code here */
        ```
        
        ```JS
        // Your updated JavaScript code here
        ```
        
        Make sure to:
        - Keep the existing functionality unless specifically asked to change it
        - Improve the code structure and add comments where helpful
        - Ensure all modifications work together seamlessly
        - Maintain responsive design and accessibility features
        """
        
        # Generate with Gemini
        generated_text = generate_with_gemini(edit_prompt)
        
        # Extract and process code
        code_sections = extract_code_sections(generated_text)
        
        return jsonify({
            "code": code_sections["full"],
            "html": code_sections["html"],
            "css": code_sections["css"],
            "js": code_sections["js"],
            "message": "Code edited successfully"
        })
        
    except Exception as e:
        print(f"Error editing code: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run the app in debug mode
    app.run(debug=True, port=5000, host='0.0.0.0')
