/**
 * AI Proctoring System
 * Uses MediaPipe FaceMesh for face and eye tracking
 * Detects: Multiple faces, No face, Phone detection, Suspicious eye movement
 */

class AIProctoring {
    constructor(assessmentId, candidateId, proctoringUrl = '/api/proctoring-incident/') {
        this.assessmentId = assessmentId;
        this.candidateId = candidateId;
        this.proctoringUrl = proctoringUrl; // Custom URL for different assessment types
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.faceMesh = null;
        this.objectDetector = null; // For phone detection
        this.isActive = false;
        
        // Detection thresholds
        this.eyeMovementThreshold = 0.15;
        this.lookingAwayDuration = 3000; // 3 seconds
        this.lastLookingAwayTime = null;
        this.faceDetectionInterval = 1000; // Check every second
        this.objectDetectionInterval = 2000; // Check for objects every 2 seconds
        this.lastFaceCount = 1;
        
        // Incident tracking
        this.incidentCooldown = 5000; // 5 seconds between same incident types
        this.lastIncidents = {};
        
        // Alert UI elements
        this.alertContainer = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Create video and canvas elements
            this.createVideoElements();
            
            // Initialize MediaPipe FaceMesh
            await this.initializeFaceMesh();
            
            // Initialize COCO-SSD for object detection (phone, etc.)
            await this.initializeObjectDetection();
            
            // Start webcam
            await this.startWebcam();
            
            // Start detection loop
            this.startDetection();
            
            console.log('AI Proctoring initialized successfully');
        } catch (error) {
            console.error('Failed to initialize AI Proctoring:', error);
            this.showError('Failed to start proctoring. Please check camera permissions.');
        }
    }
    
    async initializeObjectDetection() {
        // Load COCO-SSD model for object detection
        if (typeof cocoSsd !== 'undefined') {
            try {
                this.objectDetector = await cocoSsd.load();
                console.log('Object detection model loaded');
            } catch (error) {
                console.warn('Failed to load object detection model:', error);
            }
        } else {
            console.warn('COCO-SSD not available. Phone detection disabled.');
        }
    }
    
    createVideoElements() {
        // Create container
        const container = document.createElement('div');
        container.id = 'proctoring-container';
        container.style.cssText = `
    position: fixed;
    top: 50%;
    left: 10px;
    transform: translateY(-50%);
    z-index: 9999;
    background: white;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 10px;
    transition: all 0.3s ease;
`;

        
        // Create video element
        this.video = document.createElement('video');
        this.video.id = 'proctoring-video';
        this.video.autoplay = true;
        this.video.muted = true;
        this.video.style.cssText = `
            width: 200px;
            height: 150px;
            border-radius: 8px;
            display: block;
        `;
        
        // Create canvas for drawing
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'none';
        this.ctx = this.canvas.getContext('2d');
        
        // Create status indicator
        const statusDiv = document.createElement('div');
        statusDiv.id = 'proctoring-status';
        statusDiv.style.cssText = `
            text-align: center;
            margin-top: 5px;
            font-size: 12px;
            color: #28a745;
            font-weight: bold;
        `;
        statusDiv.innerHTML = '🟢 Proctoring Active';
        
        container.appendChild(this.video);
        container.appendChild(statusDiv);
        container.appendChild(this.canvas);
        document.body.appendChild(container);
        
        // Create alert container
        this.alertContainer = document.createElement('div');
        this.alertContainer.id = 'proctoring-alerts';
        this.alertContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(this.alertContainer);
    }
    
    async initializeFaceMesh() {
        // Check if MediaPipe is loaded
        if (typeof FaceMesh === 'undefined') {
            console.warn('MediaPipe FaceMesh not loaded. Using basic face detection.');
            return;
        }
        
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        this.faceMesh.setOptions({
            maxNumFaces: 3,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.faceMesh.onResults((results) => this.onFaceMeshResults(results));
    }
    
    async startWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            this.video.srcObject = stream;
            this.isActive = true;
            
            // Set canvas dimensions
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            });
        } catch (error) {
            console.error('Webcam access denied:', error);
            throw new Error('Camera permission required for proctoring');
        }
    }
    
    startDetection() {
        if (!this.isActive) return;
        
        // Run face detection
        setInterval(() => {
            if (this.faceMesh && this.video.readyState === 4) {
                this.faceMesh.send({ image: this.video });
            } else {
                // Fallback: Basic face detection
                this.basicFaceDetection();
            }
        }, this.faceDetectionInterval);
        
        // Run object detection (phone, etc.)
        setInterval(() => {
            if (this.objectDetector && this.video.readyState === 4) {
                this.detectObjects();
            }
        }, this.objectDetectionInterval);
    }
    
    async detectObjects() {
        try {
            const predictions = await this.objectDetector.detect(this.video);
            
            for (let prediction of predictions) {
                // Detect cell phone
                if (prediction.class === 'cell phone' && prediction.score > 0.6) {
                    this.reportIncident('phone_detected', 
                        `Phone detected with ${(prediction.score * 100).toFixed(1)}% confidence`, 
                        'critical');
                }
                
                // Detect multiple people (person class)
                const peopleDetected = predictions.filter(p => p.class === 'person' && p.score > 0.7);
                if (peopleDetected.length > 1) {
                    this.reportIncident('multiple_faces', 
                        `${peopleDetected.length} people detected in frame`, 
                        'high');
                }
            }
        } catch (error) {
            console.debug('Object detection error:', error);
        }
    }
    
    onFaceMeshResults(results) {
        const faceCount = results.multiFaceLandmarks ? results.multiFaceLandmarks.length : 0;
        
        // Check for multiple faces
        if (faceCount > 1) {
            this.reportIncident('multiple_faces', `${faceCount} faces detected`, 'high');
        }
        
        // Check for no face
        if (faceCount === 0) {
            this.reportIncident('no_face', 'No face detected in frame', 'medium');
        }
        
        // Analyze eye movement if face is detected
        if (faceCount === 1 && results.multiFaceLandmarks[0]) {
            this.analyzeEyeMovement(results.multiFaceLandmarks[0]);
        }
        
        // Draw landmarks (optional, for debugging)
        // this.drawLandmarks(results);
    }
    
    analyzeEyeMovement(landmarks) {
        // Get eye landmarks
        // Left eye: indices 33, 133, 160, 159, 158, 157, 173
        // Right eye: indices 362, 263, 387, 386, 385, 384, 398
        
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const noseTip = landmarks[1];
        
        if (!leftEye || !rightEye || !noseTip) return;
        
        // Calculate gaze direction (simplified)
        const leftGazeX = leftEye.x - noseTip.x;
        const rightGazeX = rightEye.x - noseTip.x;
        const avgGazeX = (leftGazeX + rightGazeX) / 2;
        
        // Check if looking away (threshold-based)
        if (Math.abs(avgGazeX) > this.eyeMovementThreshold) {
            if (!this.lastLookingAwayTime) {
                this.lastLookingAwayTime = Date.now();
            } else if (Date.now() - this.lastLookingAwayTime > this.lookingAwayDuration) {
                this.reportIncident('looking_away', 'Candidate looking away from screen', 'medium');
                this.lastLookingAwayTime = null;
            }
        } else {
            this.lastLookingAwayTime = null;
        }
        
        // Detect suspicious rapid eye movement
        // (Implementation can be enhanced with more sophisticated algorithms)
    }
    
    basicFaceDetection() {
        // Fallback method using canvas and basic image processing
        // This is a simplified version - real implementation would use face-api.js or similar
        console.log('Running basic face detection...');
    }
    
    reportIncident(incidentType, details, severity = 'medium') {
        // Check cooldown
        const now = Date.now();
        if (this.lastIncidents[incidentType] && 
            now - this.lastIncidents[incidentType] < this.incidentCooldown) {
            return; // Skip if same incident reported recently
        }
        
        this.lastIncidents[incidentType] = now;
        
        // Show alert to candidate
        this.showAlert(incidentType, details, severity);
        
        // Capture screenshot
        this.captureScreenshot((screenshot) => {
            // Send to server
            this.sendIncidentToServer(incidentType, details, severity, screenshot);
        });
    }
    
    showAlert(incidentType, details, severity) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${severity === 'high' || severity === 'critical' ? 'danger' : 'warning'} alert-dismissible fade show`;
        alertDiv.style.cssText = `
            margin-bottom: 10px;
            animation: slideIn 0.3s ease-out;
        `;
        
        const icons = {
            'multiple_faces': '👥',
            'no_face': '❌',
            'phone_detected': '📱',
            'looking_away': '👀',
            'suspicious_eye_movement': '👁️'
        };
        
        alertDiv.innerHTML = `
            <strong>${icons[incidentType] || '⚠️'} Proctoring Alert!</strong><br>
            ${details}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        this.alertContainer.appendChild(alertDiv);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
        
        // Play alert sound
        this.playAlertSound();
    }
    
    playAlertSound() {
        // Create a simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }
    
    captureScreenshot(callback) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0);
        
        this.canvas.toBlob((blob) => {
            callback(blob);
        }, 'image/jpeg', 0.8);
    }
    
    sendIncidentToServer(incidentType, details, severity, screenshot) {
        const formData = new FormData();
        formData.append('assessment_id', this.assessmentId);
        formData.append('incident_type', incidentType);
        formData.append('details', details);
        formData.append('severity', severity);
        if (screenshot) {
            formData.append('screenshot', screenshot, 'incident.jpg');
        }
        
        fetch(this.proctoringUrl, {
            method: 'POST',
            headers: {
                'X-CSRFToken': this.getCSRFToken()
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log('Incident reported:', data);
            if (data.email_sent) {
                console.log('Alert email sent to admin and candidate');
            }
        })
        .catch(error => {
            console.error('Failed to report incident:', error);
        });
    }
    
    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10001;
            max-width: 500px;
        `;
        errorDiv.innerHTML = `<strong>Proctoring Error:</strong> ${message}`;
        document.body.appendChild(errorDiv);
    }
    
    stop() {
        this.isActive = false;
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        document.getElementById('proctoring-container')?.remove();
        document.getElementById('proctoring-alerts')?.remove();
    }
}

// Auto-initialize if on assessment page
document.addEventListener('DOMContentLoaded', () => {
  const assessmentId = document.getElementById('assessment-id')?.value;
  const candidateId = document.getElementById('candidate-id')?.value;

  const tryInit = () => {
    if (!window.__ASSESSMENT_ACTIVE__) { setTimeout(tryInit, 300); return; }
    if (assessmentId && candidateId) {
      window.aiProctoring = new AIProctoring(assessmentId, candidateId);
    }
  };
  tryInit();
});


// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
