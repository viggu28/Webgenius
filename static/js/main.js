document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const promptInput = document.getElementById('prompt');
    const imagePromptInput = document.getElementById('imagePrompt');
    const editInstructionsInput = document.getElementById('editInstructions');
    const pageStyleSelect = document.getElementById('pageStyle');
    const featuresInput = document.getElementById('features');
    const generateBtn = document.getElementById('generateBtn');
    const generateBtnText = document.getElementById('generateBtnText');
    const previewFrame = document.getElementById('previewFrame');
    const downloadBtn = document.getElementById('downloadBtn');
    const newDesignBtn = document.getElementById('newDesignBtn');
    const editCodeBtn = document.getElementById('editCodeBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const codeView = document.getElementById('codeView');
    const codeTabs = document.querySelectorAll('.code-tab');
    const codeContents = document.querySelectorAll('.code-content');
    const copyCodeBtns = document.querySelectorAll('.copy-code-btn');
    const downloadCodeBtns = document.querySelectorAll('.download-code-btn');
    const tabs = document.querySelectorAll('.tab');
    const deviceToggle = document.querySelectorAll('.device-toggle i');
    const previewWrapper = document.querySelector('.preview-wrapper');
    const themeToggle = document.querySelector('.theme-toggle');
    const exampleCards = document.querySelectorAll('.example-card');
    const toast = document.getElementById('toast');
    
    // Input method elements
    const inputTabs = document.querySelectorAll('.input-tab');
    const inputContainers = document.querySelectorAll('.input-container');
    
    // Image upload elements
    const imageUploadContainer = document.getElementById('imageUploadContainer');
    const websiteImage = document.getElementById('websiteImage');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.querySelector('.image-preview-container');
    const removeImageBtn = document.getElementById('removeImageBtn');
    
    // Code upload elements
    const htmlFile = document.getElementById('htmlFile');
    const cssFile = document.getElementById('cssFile');
    const jsFile = document.getElementById('jsFile');
    const htmlFilePreview = document.getElementById('htmlFilePreview');
    const cssFilePreview = document.getElementById('cssFilePreview');
    const jsFilePreview = document.getElementById('jsFilePreview');
    
    // Modal elements
    const editModal = document.getElementById('editModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const cancelEdit = document.getElementById('cancelEdit');
    const applyEdit = document.getElementById('applyEdit');
    const modalEditInstructions = document.getElementById('modalEditInstructions');
    
    // Store generated code sections
    let generatedCode = {
        full: '',
        html: '',
        css: '',
        js: ''
    };
    
    // Track current input method
    let currentInputMethod = 'text';
    let uploadedCodeFiles = {};
    
    // Theme Toggle
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        themeToggle.querySelectorAll('i').forEach(icon => {
            icon.classList.toggle('hidden');
        });
        
        const isDarkMode = document.body.classList.contains('dark-theme');
        localStorage.setItem('darkMode', isDarkMode);
        
        showToast(isDarkMode ? 'Dark mode activated' : 'Light mode activated');
    });
    
    // Check for saved theme preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-theme');
        themeToggle.querySelectorAll('i').forEach(icon => {
            icon.classList.toggle('hidden');
        });
    }
    
    // Input method tab switching
    inputTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const method = tab.getAttribute('data-method');
            
            // Update active tab
            inputTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show/hide input containers
            inputContainers.forEach(container => {
                container.classList.add('hidden');
            });
            
            currentInputMethod = method;
            
            if (method === 'text') {
                document.getElementById('textInputContainer').classList.remove('hidden');
                generateBtnText.textContent = 'Generate Webpage';
            } else if (method === 'image') {
                document.getElementById('imageInputContainer').classList.remove('hidden');
                generateBtnText.textContent = 'Generate from Image';
            } else if (method === 'code') {
                document.getElementById('codeInputContainer').classList.remove('hidden');
                generateBtnText.textContent = 'Edit Code';
            }
        });
    });
    
    // Image upload functionality
    imageUploadContainer.addEventListener('click', () => {
        if (!imagePreviewContainer.classList.contains('hidden')) return;
        websiteImage.click();
    });
    
    websiteImage.addEventListener('change', handleImageUpload);
    
    function handleImageUpload(e) {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            if (!file.type.match('image.*')) {
                showToast('Please select an image file (PNG, JPEG, GIF)', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image size should be less than 5MB', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreviewContainer.classList.remove('hidden');
                imageUploadContainer.querySelector('.upload-icon').style.display = 'none';
                imageUploadContainer.querySelector('.upload-text').style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    }
    
    removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imagePreview.src = '';
        websiteImage.value = '';
        imagePreviewContainer.classList.add('hidden');
        imageUploadContainer.querySelector('.upload-icon').style.display = 'block';
        imageUploadContainer.querySelector('.upload-text').style.display = 'block';
    });
    
    // Drag and drop for images
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        imageUploadContainer.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        imageUploadContainer.addEventListener(eventName, () => {
            imageUploadContainer.classList.add('dragging');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        imageUploadContainer.addEventListener(eventName, () => {
            imageUploadContainer.classList.remove('dragging');
        }, false);
    });
    
    imageUploadContainer.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        
        if (!file || !file.type.match('image.*')) {
            showToast('Please drop an image file', 'error');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size should be less than 5MB', 'error');
            return;
        }
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        websiteImage.files = dataTransfer.files;
        
        const event = new Event('change', { bubbles: true });
        websiteImage.dispatchEvent(event);
    }, false);
    
    // Code file upload functionality
    [htmlFile, cssFile, jsFile].forEach((fileInput, index) => {
        const fileType = ['html', 'css', 'js'][index];
        const preview = [htmlFilePreview, cssFilePreview, jsFilePreview][index];
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const content = e.target.result;
                    uploadedCodeFiles[fileType] = content;
                    preview.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                    preview.style.color = 'var(--secondary-color)';
                };
                
                reader.readAsText(file);
            }
        });
    });
    
    // Tab switching functionality
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tabName === 'preview') {
                previewWrapper.style.display = 'flex';
                codeView.style.display = 'none';
            } else if (tabName === 'code') {
                previewWrapper.style.display = 'none';
                codeView.style.display = 'block';
                
                if (!document.querySelector('.code-tab.active')) {
                    document.querySelector('.code-tab').classList.add('active');
                    document.querySelector('.code-content').style.display = 'block';
                }
            }
        });
    });
    
    // Code tab switching
    codeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const codeType = tab.getAttribute('data-code');
            
            codeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            codeContents.forEach(content => {
                if (content.getAttribute('data-code') === codeType) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
    
    // Device toggle functionality
    deviceToggle.forEach(device => {
        device.addEventListener('click', () => {
            const deviceType = device.getAttribute('data-device');
            
            deviceToggle.forEach(d => d.classList.remove('active'));
            device.classList.add('active');
            
            previewWrapper.setAttribute('data-device', deviceType);
        });
    });
    
    // Example card functionality
    exampleCards.forEach(card => {
        const useButton = card.querySelector('.use-example');
        
        useButton.addEventListener('click', () => {
            const examplePrompt = card.getAttribute('data-prompt');
            
            // Switch to text input method if not already
            if (currentInputMethod !== 'text') {
                document.querySelector('.input-tab[data-method="text"]').click();
            }
            
            promptInput.value = examplePrompt;
            promptInput.focus();
            promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('Example prompt loaded');
        });
    });
    
    // Copy code functionality
    copyCodeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const codeType = btn.getAttribute('data-code');
            let codeToCopy = generatedCode[codeType] || '';
            
            if (!codeToCopy) {
                showToast(`No ${codeType} code to copy yet`, 'error');
                return;
            }
            
            navigator.clipboard.writeText(codeToCopy)
                .then(() => {
                    showToast(`${codeType.toUpperCase()} code copied to clipboard!`);
                })
                .catch(err => {
                    showToast('Failed to copy code', 'error');
                    console.error('Failed to copy: ', err);
                });
        });
    });
    
    // Download code functionality
    downloadCodeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const codeType = btn.getAttribute('data-code');
            let codeToDownload = '';
            let filename = '';
            let fileType = '';
            
            switch(codeType) {
                case 'html':
                    codeToDownload = generatedCode.html;
                    filename = 'index.html';
                    fileType = 'text/html';
                    break;
                case 'css':
                    codeToDownload = generatedCode.css;
                    filename = 'styles.css';
                    fileType = 'text/css';
                    break;
                case 'js':
                    codeToDownload = generatedCode.js;
                    filename = 'script.js';
                    fileType = 'application/javascript';
                    break;
                default:
                    codeToDownload = generatedCode.full;
                    filename = 'webpage.html';
                    fileType = 'text/html';
                    break;
            }
            
            if (!codeToDownload) {
                showToast(`No ${codeType} code to download yet`, 'error');
                return;
            }
            
            downloadFile(codeToDownload, filename, fileType);
            showToast(`${filename} downloaded successfully`);
        });
    });
    
    // Generate webpage functionality
    generateBtn.addEventListener('click', async () => {
        try {
            generateBtn.disabled = true;
            loadingIndicator.style.display = 'flex';
            previewFrame.style.display = 'none';
            downloadBtn.disabled = true;
            newDesignBtn.disabled = true;
            editCodeBtn.disabled = true;
            
            let response;
            
            if (currentInputMethod === 'text') {
                const prompt = promptInput.value.trim();
                if (!prompt) {
                    showToast('Please enter a description', 'error');
                    return;
                }
                
                response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt,
                        style: pageStyleSelect.value,
                        features: featuresInput.value.trim()
                    })
                });
            } else if (currentInputMethod === 'image') {
                if (!websiteImage.files[0]) {
                    showToast('Please upload an image', 'error');
                    return;
                }
                
                const formData = new FormData();
                formData.append('website_image', websiteImage.files[0]);
                formData.append('prompt', imagePromptInput.value.trim());
                formData.append('pageStyle', pageStyleSelect.value);
                formData.append('features', featuresInput.value.trim());
                
                response = await fetch('/api/generate', {
                    method: 'POST',
                    body: formData
                });
            } else if (currentInputMethod === 'code') {
                const instructions = editInstructionsInput.value.trim();
                if (!instructions) {
                    showToast('Please provide edit instructions', 'error');
                    return;
                }
                
                if (Object.keys(uploadedCodeFiles).length === 0) {
                    showToast('Please upload at least one code file', 'error');
                    return;
                }
                
                const formData = new FormData();
                if (htmlFile.files[0]) formData.append('html_file', htmlFile.files[0]);
                if (cssFile.files[0]) formData.append('css_file', cssFile.files[0]);
                if (jsFile.files[0]) formData.append('js_file', jsFile.files[0]);
                formData.append('edit_instructions', instructions);
                formData.append('pageStyle', pageStyleSelect.value);
                formData.append('features', featuresInput.value.trim());
                
                response = await fetch('/api/generate', {
                    method: 'POST',
                    body: formData
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Server error: ${response.status}` }));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Store generated code
            generatedCode = {
                full: data.code,
                html: data.html || '',
                css: data.css || '',
                js: data.js || ''
            };
            
            // Update code displays
            document.querySelector('.code-content[data-code="html"] code').textContent = generatedCode.html;
            document.querySelector('.code-content[data-code="css"] code').textContent = generatedCode.css;
            document.querySelector('.code-content[data-code="js"] code').textContent = generatedCode.js;
            document.querySelector('.code-content[data-code="full"] code').textContent = generatedCode.full;
            
            // Highlight code
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }
            
            // Display in preview
            const frameDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
            frameDoc.open();
            frameDoc.write(generatedCode.full);
            frameDoc.close();
            
            // Enable buttons
            downloadBtn.disabled = false;
            newDesignBtn.disabled = false;
            editCodeBtn.disabled = false;
            
            // Switch to preview tab
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="preview"]').classList.add('active');
            previewWrapper.style.display = 'flex';
            codeView.style.display = 'none';
            previewFrame.style.display = 'block';
            
            showToast(data.edit_mode ? 'Code edited successfully!' : 'Webpage generated successfully!');
            
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            console.error(error);
        } finally {
            generateBtn.disabled = false;
            loadingIndicator.style.display = 'none';
            previewFrame.style.display = 'block';
        }
    });
    
    // Edit code button functionality
    editCodeBtn.addEventListener('click', () => {
        if (!generatedCode.full) {
            showToast('No code to edit yet', 'error');
            return;
        }
        
        editModal.classList.remove('hidden');
        modalEditInstructions.focus();
    });
    
    // Modal functionality
    closeEditModal.addEventListener('click', () => {
        editModal.classList.add('hidden');
        modalEditInstructions.value = '';
    });
    
    cancelEdit.addEventListener('click', () => {
        editModal.classList.add('hidden');
        modalEditInstructions.value = '';
    });
    
    applyEdit.addEventListener('click', async () => {
        const instructions = modalEditInstructions.value.trim();
        if (!instructions) {
            showToast('Please provide edit instructions', 'error');
            return;
        }
        
        try {
            applyEdit.disabled = true;
            
            const response = await fetch('/api/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: generatedCode.html,
                    css: generatedCode.css,
                    js: generatedCode.js,
                    instructions: instructions
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Server error: ${response.status}` }));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Update generated code
            generatedCode = {
                full: data.code,
                html: data.html || '',
                css: data.css || '',
                js: data.js || ''
            };
            
            // Update displays
            document.querySelector('.code-content[data-code="html"] code').textContent = generatedCode.html;
            document.querySelector('.code-content[data-code="css"] code').textContent = generatedCode.css;
            document.querySelector('.code-content[data-code="js"] code').textContent = generatedCode.js;
            document.querySelector('.code-content[data-code="full"] code').textContent = generatedCode.full;
            
            // Highlight code
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }
            
            // Update preview
            const frameDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
            frameDoc.open();
            frameDoc.write(generatedCode.full);
            frameDoc.close();
            
            editModal.classList.add('hidden');
            modalEditInstructions.value = '';
            showToast('Code edited successfully!');
            
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            console.error(error);
        } finally {
            applyEdit.disabled = false;
        }
    });
    
    // New design button
    newDesignBtn.addEventListener('click', () => {
        generateBtn.click();
    });
    
    // Download button
    downloadBtn.addEventListener('click', () => {
        if (!generatedCode.full) {
            showToast('No webpage has been generated yet', 'error');
            return;
        }
        
        downloadFile(generatedCode.full, 'generated-webpage.html', 'text/html');
        showToast('HTML file downloaded');
    });
    
    // Utility functions
    function downloadFile(content, filename, fileType) {
        const blob = new Blob([content], { type: fileType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function showToast(message, type = 'success') {
        const toastMessage = toast.querySelector('.toast-message');
        const toastIcon = toast.querySelector('.toast-icon');
        const toastProgress = toast.querySelector('.toast-progress');
        
        toastMessage.textContent = message;
        
        if (type === 'success') {
            toastIcon.className = 'fas fa-check-circle toast-icon';
            toastIcon.style.color = 'var(--secondary-color)';
        } else if (type === 'error') {
            toastIcon.className = 'fas fa-exclamation-circle toast-icon';
            toastIcon.style.color = '#ef4444';
        } else if (type === 'info') {
            toastIcon.className = 'fas fa-info-circle toast-icon';
            toastIcon.style.color = '#3b82f6';
        }
        
        toast.classList.add('show');
        
        toastProgress.style.width = '0';
        setTimeout(() => {
            toastProgress.style.width = '100%';
            toastProgress.style.transition = 'width 3s linear';
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // Add animation effects
    function addScrollAnimations() {
        const elements = document.querySelectorAll('.feature-card, .example-card, .step-card');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });
        
        elements.forEach(element => {
            // Set initial state
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            observer.observe(element);
        });
    }
    
    // Handle form submission with Enter key (prevent default)
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && event.target.tagName.toLowerCase() === 'textarea') {
            // Allow Enter key in textareas
            return;
        }
        
        if (event.key === 'Enter' && (event.target.tagName.toLowerCase() === 'input' || event.target.tagName.toLowerCase() === 'select')) {
            event.preventDefault();
            // Trigger generate button if Enter is pressed on an input field
            if (!generateBtn.disabled) {
                generateBtn.click();
            }
        }
    });
    
    // Add textarea auto-resize
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    });
    
    // Initialize animations
    addScrollAnimations();
    
    // Check for browser compatibility
    if (!('IntersectionObserver' in window)) {
        console.warn('IntersectionObserver not supported in this browser. Some animations may not work.');
        // Make elements visible if IntersectionObserver is not supported
        document.querySelectorAll('.feature-card, .example-card, .step-card').forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }
    
    // Handle page visibility changes (pause animations when tab is not visible)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.body.classList.add('paused');
        } else {
            document.body.classList.remove('paused');
        }
    });
    
    // Show initial notification
    setTimeout(() => {
        showToast('Welcome to WebGenius! Describe your webpage or upload an image to get started.', 'info');
    }, 1000);
});