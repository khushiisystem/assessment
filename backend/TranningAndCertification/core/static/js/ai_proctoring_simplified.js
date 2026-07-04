/**
 * Simplified AI Proctoring System
 * Features:
 * 1. Multiple Face Detection (Haar Cascades - High Accuracy)
 * 2. Phone Detection (MediaPipe - High Accuracy)
 * 3. Looking Away (20 seconds threshold)
 * 4. Tab Switch Detection
 */

class SimplifiedProctoring {
    constructor(assessmentId, candidateId, proctoringUrl = '/ai-assessment/save-proctoring-incident/') {
        this.assessmentId = assessmentId;
        this.candidateId = candidateId;
        this.proctoringUrl = proctoringUrl;
        
        // Video elements
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        
        // Cascade loaded flag
        this.cascadeLoaded = false;
        
        // Detection intervals
        this.faceDetectionInterval = null;
        this.phoneDetectionInterval = null;
        
        // Thresholds
        this.lookingAwayThreshold = 20000; // 20 seconds
        this.phoneDetectionConfidence = 0.85; // 85% confidence for phone
        this.multipleFaceConfidence = 0.80; // 80% confidence for multiple faces
        
        // Tracking
        this.lookingAwayStartTime = null;
        this.lookingAwayAlertSent = false;
        this.tabSwitchCount = 0;
        
        // Cooldowns to prevent spam
        this.lastAlerts = {
            multiple_faces: 0,
            phone_detected: 0,
            looking_away: 0,
            tab_switch: 0
        };
        this.alertCooldown = 10000; // 10 seconds between same alerts
        
        this.init();
    }
    
    async init() {
        try {
            console.log('='.repeat(60));
            console.log('🔒 INITIALIZING SIMPLIFIED PROCTORING SYSTEM');
            console.log('='.repeat(60));
            
            // Get video element (should already exist from main assessment)
            console.log('📹 Step 1: Looking for video element...');
            this.video = document.getElementById('video');
            if (!this.video) {
                console.error('❌ ERROR: Video element not found!');
                console.log('Available video elements:', document.querySelectorAll('video'));
                return;
            }
            console.log('✅ Video element found:', this.video);
            console.log('   - Video ready state:', this.video.readyState);
            console.log('   - Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
            
            // Create canvas for processing
            console.log('🖼️ Step 2: Creating canvas for frame processing...');
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
            console.log('✅ Canvas created');
            
            // Load Haar Cascade for face detection
            console.log('📚 Step 3: Loading Haar Cascade for face detection...');
            await this.loadHaarCascade();
            
            // Start detection loops
            console.log('🔄 Step 4: Starting detection loops...');
            
            // CAMERA-BASED PROCTORING DISABLED (Camera stays ON for recording)
            // this.startFaceDetection();
            // console.log('   ✅ Face detection started (every 2 seconds)');
            
            // this.startPhoneDetection();
            // console.log('   ✅ Phone detection started (every 3 seconds)');
            
            this.startTabSwitchDetection();
            console.log('   ✅ Tab switch detection started');
            console.log('   ⚠️ Camera-based proctoring DISABLED (Multiple faces, Looking away, Phone detection)');
            
            console.log('='.repeat(60));
            console.log('✅ SIMPLIFIED PROCTORING INITIALIZED SUCCESSFULLY');
            console.log('='.repeat(60));
            console.log('Monitoring:');
            console.log('  - Tab Switching (immediate) ✅ ACTIVE');
            console.log('');
            console.log('DISABLED (Camera-based):');
            console.log('  - Multiple Faces ❌ DISABLED');
            console.log('  - Looking Away ❌ DISABLED');
            console.log('  - Phone Detection ❌ DISABLED');
            console.log('  - No Face Detection ❌ DISABLED');
            console.log('='.repeat(60));
        } catch (error) {
            console.error('❌ FAILED TO INITIALIZE PROCTORING:', error);
            console.error('Error stack:', error.stack);
        }
    }
    
    async loadHaarCascade() {
        // Load OpenCV.js if not already loaded
        if (typeof cv === 'undefined') {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://docs.opencv.org/4.5.2/opencv.js';
                script.async = true;
                script.onload = () => {
                    console.log('✅ OpenCV.js loaded');
                    // Wait for cv to be ready
                    if (cv.getBuildInformation) {
                        console.log('✅ OpenCV ready immediately');
                        this.loadCascadeFile();
                        resolve();
                    } else {
                        cv['onRuntimeInitialized'] = () => {
                            console.log('✅ OpenCV ready');
                            this.loadCascadeFile();
                            resolve();
                        };
                    }
                };
                script.onerror = () => reject(new Error('Failed to load OpenCV.js'));
                document.head.appendChild(script);
            });
        } else {
            console.log('✅ OpenCV already loaded');
            this.loadCascadeFile();
        }
    }
    
    loadCascadeFile() {
        // Load Haar Cascade XML file
        const cascadeUrl = 'https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml';
        
        console.log('🔽 Downloading Haar Cascade from GitHub...');
        console.log('   URL:', cascadeUrl);
        
        fetch(cascadeUrl)
            .then(response => {
                console.log('📥 Cascade download response:', response.status, response.statusText);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(buffer => {
                console.log('💾 Cascade file downloaded:', buffer.byteLength, 'bytes');
                const data = new Uint8Array(buffer);
                cv.FS_createDataFile('/', 'haarcascade_frontalface_default.xml', data, true, false, false);
                console.log('✅ Haar Cascade file loaded into OpenCV filesystem');
                this.cascadeLoaded = true;
            })
            .catch(error => {
                console.error('❌ Failed to load Haar Cascade:', error);
                console.error('   This will prevent face detection from working!');
                this.cascadeLoaded = false;
            });
    }
    
    startFaceDetection() {
        // DISABLED: Check for multiple faces every 2 seconds using Haar Cascades
        // this.faceDetectionInterval = setInterval(() => {
        //     this.detectMultipleFaces();
        // }, 2000);
        console.log('⚠️ Face detection DISABLED');
    }
    
    async detectMultipleFaces() {
        // Detailed checks
        if (!this.video) {
            console.error('❌ detectMultipleFaces: Video element is null');
            return;
        }
        if (this.video.readyState !== 4) {
            console.log('⏳ detectMultipleFaces: Video not ready (readyState:', this.video.readyState, ')');
            return;
        }
        if (typeof cv === 'undefined') {
            console.error('❌ detectMultipleFaces: OpenCV (cv) is undefined');
            return;
        }
        if (!cv.CascadeClassifier) {
            console.error('❌ detectMultipleFaces: cv.CascadeClassifier not available');
            return;
        }
        if (!this.cascadeLoaded) {
            console.log('⏳ detectMultipleFaces: Waiting for Haar Cascade to load...');
            return;
        }
        
        try {
            // Capture frame
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0);
            
            // Convert to OpenCV format
            let src = cv.imread(this.canvas);
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            
            // Load face cascade
            let faceCascade = new cv.CascadeClassifier();
            let cascadeLoaded = faceCascade.load('haarcascade_frontalface_default.xml');
            
            if (!cascadeLoaded) {
                console.error('❌ Failed to load cascade classifier');
                src.delete();
                gray.delete();
                return;
            }
            
            // Detect faces with stricter parameters to reduce false positives
            let faces = new cv.RectVector();
            let minSize = new cv.Size(60, 60); // Minimum face size (increased from 0)
            let maxSize = new cv.Size(0, 0);
            // Parameters: scaleFactor=1.3 (increased), minNeighbors=5 (increased), minSize=60x60
            faceCascade.detectMultiScale(gray, faces, 1.3, 5, 0, minSize, maxSize);
            
            const faceCount = faces.size();
            console.log(`👤 Faces detected: ${faceCount}`);
            
            // Check for multiple faces with high confidence
            if (faceCount > 1) {
                // Verify it's really multiple faces (not false positive)
                // Check if faces are sufficiently separated
                let validMultipleFaces = this.verifyMultipleFaces(faces);
                
                if (validMultipleFaces) {
                    await this.sendAlert('multiple_faces', 
                        `${faceCount} faces detected in frame`, 
                        'critical', 
                        true); // Include screenshot
                }
            }
            
            // Check for looking away (no face detected)
            if (faceCount === 0) {
                if (this.lookingAwayStartTime === null) {
                    this.lookingAwayStartTime = Date.now();
                    this.lookingAwayAlertSent = false;
                    console.log('⏱️ Started tracking looking away...');
                } else {
                    const duration = Date.now() - this.lookingAwayStartTime;
                    const secondsElapsed = Math.round(duration/1000);
                    console.log(`⏱️ Looking away: ${secondsElapsed}s / 20s`);
                    
                    if (duration >= this.lookingAwayThreshold && !this.lookingAwayAlertSent) {
                        console.log('🚨 20 seconds elapsed - sending looking away alert!');
                        await this.sendAlert('looking_away', 
                            `Candidate looking away for ${secondsElapsed} seconds`, 
                            'medium', 
                            true);
                        this.lookingAwayAlertSent = true;
                    }
                }
            } else {
                // Reset looking away tracking
                if (this.lookingAwayStartTime !== null) {
                    console.log('✅ Face detected again - resetting looking away timer');
                }
                this.lookingAwayStartTime = null;
                this.lookingAwayAlertSent = false;
            }
            
            // Cleanup
            src.delete();
            gray.delete();
            faces.delete();
            faceCascade.delete();
            
        } catch (error) {
            console.debug('Face detection error:', error);
        }
    }
    
    verifyMultipleFaces(faces) {
        // Verify that detected faces are actually separate people
        // Check minimum distance between face centers and face sizes
        if (faces.size() < 2) return false;
        
        const minDistance = 150; // Increased minimum pixels between face centers
        const minFaceSize = 50; // Minimum face width/height
        
        // First, filter out faces that are too small (likely false positives)
        let validFaces = [];
        for (let i = 0; i < faces.size(); i++) {
            let face = faces.get(i);
            if (face.width >= minFaceSize && face.height >= minFaceSize) {
                validFaces.push(face);
            } else {
                console.log(`⚠️ Ignoring small face detection: ${face.width}x${face.height}`);
            }
        }
        
        if (validFaces.length < 2) {
            console.log(`⚠️ Only ${validFaces.length} valid faces after filtering`);
            return false;
        }
        
        // Check distance between valid faces
        for (let i = 0; i < validFaces.length; i++) {
            let face1 = validFaces[i];
            let center1 = {
                x: face1.x + face1.width / 2,
                y: face1.y + face1.height / 2
            };
            
            for (let j = i + 1; j < validFaces.length; j++) {
                let face2 = validFaces[j];
                let center2 = {
                    x: face2.x + face2.width / 2,
                    y: face2.y + face2.height / 2
                };
                
                let distance = Math.sqrt(
                    Math.pow(center2.x - center1.x, 2) + 
                    Math.pow(center2.y - center1.y, 2)
                );
                
                console.log(`📏 Distance between faces: ${Math.round(distance)}px (min: ${minDistance}px)`);
                
                if (distance >= minDistance) {
                    console.log(`✅ Valid multiple faces detected (distance: ${Math.round(distance)}px)`);
                    return true; // Valid multiple faces
                }
            }
        }
        
        console.log(`⚠️ Multiple faces detected but too close together (likely false positive)`);
        return false; // Faces too close, likely false positive
    }
    
    startPhoneDetection() {
        // DISABLED: Check for phone every 3 seconds using MediaPipe Object Detection
        // this.phoneDetectionInterval = setInterval(() => {
        //     this.detectPhone();
        // }, 3000);
        console.log('⚠️ Phone detection DISABLED');
    }
    
    async detectPhone() {
        if (!this.video || this.video.readyState !== 4) return;
        
        try {
            // Use MediaPipe Object Detection API
            // This requires the gesture analysis endpoint
            const formData = new FormData();
            
            // Capture frame
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0);
            
            // Convert to blob
            const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/jpeg', 0.95));
            formData.append('frame', blob);
            formData.append('assessment_id', this.assessmentId);
            
            // Send to backend for analysis
            const response = await fetch('/ai-assessment/analyze-frame/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: formData
            });
            
            const result = await response.json();
            
            if (result.status === 'success' && result.analysis) {
                const phoneDetected = result.analysis.phone_detected || false;
                const phoneConfidence = result.analysis.phone_confidence || 0;
                
                console.log(`📱 Phone detection: ${phoneDetected}, Confidence: ${(phoneConfidence * 100).toFixed(1)}%`);
                
                // Only alert if confidence is high
                if (phoneDetected && phoneConfidence >= this.phoneDetectionConfidence) {
                    console.log('🚨 Phone detected with high confidence - sending alert!');
                    await this.sendAlert('phone_detected', 
                        `Phone detected with ${(phoneConfidence * 100).toFixed(1)}% confidence`, 
                        'critical', 
                        true);
                } else if (phoneDetected) {
                    console.log(`⚠️ Phone detected but confidence too low: ${(phoneConfidence * 100).toFixed(1)}% < 85%`);
                }
            } else {
                console.log('❌ Phone detection API returned error or no analysis');
            }
        } catch (error) {
            console.error('❌ Phone detection error:', error);
        }
    }
    
    startTabSwitchDetection() {
        // Detect when user switches tabs or windows
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.tabSwitchCount++;
                console.log(`⚠️ Tab switch detected (Count: ${this.tabSwitchCount})`);
                
                this.sendAlert('tab_switch', 
                    `Candidate switched tab/window (Count: ${this.tabSwitchCount})`, 
                    'high', 
                    false); // No screenshot for tab switch
            }
        });
        
        // Also detect window blur
        window.addEventListener('blur', () => {
            console.log('⚠️ Window lost focus');
        });
    }
    
    async sendAlert(type, details, severity, includeScreenshot = false) {
        // Check cooldown
        const now = Date.now();
        if (this.lastAlerts[type] && now - this.lastAlerts[type] < this.alertCooldown) {
            console.log(`⏳ Alert cooldown active for ${type}`);
            return;
        }
        
        this.lastAlerts[type] = now;
        
        try {
            const formData = new FormData();
            formData.append('assessment_id', this.assessmentId);
            formData.append('incident_type', type);
            formData.append('details', details);
            formData.append('severity', severity);
            formData.append('send_email', 'true');
            
            // Capture screenshot if requested
            if (includeScreenshot) {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.ctx.drawImage(this.video, 0, 0);
                
                const blob = await new Promise(resolve => 
                    this.canvas.toBlob(resolve, 'image/jpeg', 0.95)
                );
                formData.append('screenshot', blob, 'violation.jpg');
            }
            
            const response = await fetch(this.proctoringUrl, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: formData
            });
            
            const result = await response.json();
            console.log(`✅ Alert sent: ${type}`, result);
            
        } catch (error) {
            console.error(`❌ Failed to send alert: ${type}`, error);
        }
    }
    
    getCsrfToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    
    stop() {
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
        }
        if (this.phoneDetectionInterval) {
            clearInterval(this.phoneDetectionInterval);
        }
        console.log('🛑 Proctoring stopped');
    }
}

// Export for use
window.SimplifiedProctoring = SimplifiedProctoring;
