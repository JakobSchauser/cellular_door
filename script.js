let scene, camera, renderer, points;
let gizmoScene, gizmoCamera, gizmoRenderer;
let controls; // OrbitControls
let pointsData = [];
let typeData = []; // Store type information for each point
let currentFrame = 0;
let isPlaying = false;
let animationSpeed = 1.; // Slower default speed
let lastTime = 0;
let crossSectionMode = 'full'; // 'full', 'horizontal', 'vertical'
let currentDataset = 'drosophila.csv'; // Track current dataset
let totalFrames = 120; // Will be updated when loading data
let maxPoints = 5000; // Will be updated when loading data
let colorByType = false; // Track if coloring by type is enabled
let hasTypeData = false; // Track if current dataset has type information

// Controls
const datasetSelect = document.getElementById('datasetSelect');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const timeSlider = document.getElementById('timeSlider');
const speedSlider = document.getElementById('speedSlider');
const frameLabel = document.getElementById('frameLabel');
const speedLabel = document.getElementById('speedLabel');
const fullBtn = document.getElementById('fullBtn');
const horizontalBtn = document.getElementById('horizontalBtn');
const verticalBtn = document.getElementById('verticalBtn');
const colorToggleBtn = document.getElementById('colorToggleBtn');

// Color palette - different shades of green
const typeColors = [
    0x90EE90, // Light green
    0x32CD32, // Lime green
    0x228B22, // Forest green
    0x006400, // Dark green
    0x9ACD32, // Yellow green
    0x00FF7F, // Spring green
    0x00FA9A, // Medium spring green
    0x98FB98, // Pale green
    0x00FF00, // Bright green
    0x7CFC00, // Lawn green
];

// Initialize Three.js scene
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 120); // Start looking straight down Z-axis, more zoomed out
    camera.lookAt(0, 0, 0);

    // Add lighting for the 3D spheres
    const ambientLight = new THREE.AmbientLight(0x606060, 1.2); // Brighter ambient light
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight1.position.set(50, 50, 50);
    scene.add(directionalLight1);
    
    // Add a second directional light from a different angle
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight2.position.set(-50, 30, -30);
    scene.add(directionalLight2);
    
    // Add a third light from below for better illumination
    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight3.position.set(0, -50, 0);
    scene.add(directionalLight3);
    
    // Add additional lights for better coverage
    const directionalLight4 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight4.position.set(30, -30, 50);
    scene.add(directionalLight4);
    
    const directionalLight5 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight5.position.set(-30, 50, -50);
    scene.add(directionalLight5);
    
    // Add a point light for additional fill lighting
    const pointLight = new THREE.PointLight(0xffffff, 0.6, 200);
    pointLight.position.set(0, 30, 30);
    scene.add(pointLight);

    // Renderer optimized for maximum performance
    renderer = new THREE.WebGLRenderer({ 
        antialias: false, // Disable for better performance
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
        alpha: false,
        stencil: false // Disable stencil buffer for performance
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    document.getElementById('container').appendChild(renderer.domElement);

    // Create orientation gizmo
    createOrientationGizmo();

    // Setup OrbitControls
    setupOrbitControls();

    // Load and parse CSV data
    loadCSVData();

    // Event listeners
    setupEventListeners();

    // Start render loop
    animate();
}

function setupOrbitControls() {
    // Create OrbitControls for ultra-smooth performance
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    // Configure controls for best performance
    controls.target.set(0, 0, 0); // Look at center of the points
    controls.enableDamping = false; // Disable for better performance
    
    // Reduced rotation sensitivity for smoother feel
    controls.enableRotate = true;
    controls.rotateSpeed = 0.3; // Lower speed for smoother rotation
    
    // Optimized zooming
    controls.enableZoom = true;
    controls.zoomSpeed = 0.6; // Slower zoom for control
    controls.minDistance = 15;  // Don't get too close
    controls.maxDistance = 300; // Don't get too far
    
    // Disable panning to reduce complexity
    controls.enablePan = false;
    
    // Touch controls for mobile - simplified
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
    
    // Vertical rotation limits
    controls.minPolarAngle = 0.1; // Radians from top
    controls.maxPolarAngle = Math.PI - 0.1; // Radians from top
    
    // Update controls on change
    controls.addEventListener('change', () => {
        updateGizmoOrientation();
    });
    
    // Set initial position
    camera.position.set(0, 0, -120); // Looking straight down Z-axis, more zoomed out
    controls.update();
}

function createOrientationGizmo() {
    // Create separate scene and camera for the gizmo
    gizmoScene = new THREE.Scene();
    gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    gizmoCamera.position.set(0, 0, 5);

    // Create the gizmo renderer
    gizmoRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    gizmoRenderer.setSize(80, 80);
    gizmoRenderer.setClearColor(0x000000, 0.1); // Semi-transparent background
    document.getElementById('orientation-gizmo').appendChild(gizmoRenderer.domElement);

    // Create axis arrows
    const axisLength = 1.5;
    const arrowHeadLength = 0.3;
    const arrowHeadWidth = 0.15;

    // X-axis (Red)
    const xAxisGroup = new THREE.Group();
    const xGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const xArrow = new THREE.Mesh(xGeometry, xMaterial);
    xArrow.rotation.z = -Math.PI / 2;
    xArrow.position.x = axisLength / 2;
    
    const xHeadGeometry = new THREE.ConeGeometry(arrowHeadWidth, arrowHeadLength, 8);
    const xHead = new THREE.Mesh(xHeadGeometry, xMaterial);
    xHead.rotation.z = -Math.PI / 2;
    xHead.position.x = axisLength + arrowHeadLength / 2;
    
    xAxisGroup.add(xArrow);
    xAxisGroup.add(xHead);
    gizmoScene.add(xAxisGroup);

    // Y-axis (Green)
    const yAxisGroup = new THREE.Group();
    const yGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const yArrow = new THREE.Mesh(yGeometry, yMaterial);
    yArrow.position.y = axisLength / 2;
    
    const yHeadGeometry = new THREE.ConeGeometry(arrowHeadWidth, arrowHeadLength, 8);
    const yHead = new THREE.Mesh(yHeadGeometry, yMaterial);
    yHead.position.y = axisLength + arrowHeadLength / 2;
    
    yAxisGroup.add(yArrow);
    yAxisGroup.add(yHead);
    gizmoScene.add(yAxisGroup);

    // Z-axis (Blue)
    const zAxisGroup = new THREE.Group();
    const zGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const zArrow = new THREE.Mesh(zGeometry, zMaterial);
    zArrow.rotation.x = Math.PI / 2;
    zArrow.position.z = axisLength / 2;
    
    const zHeadGeometry = new THREE.ConeGeometry(arrowHeadWidth, arrowHeadLength, 8);
    const zHead = new THREE.Mesh(zHeadGeometry, zMaterial);
    zHead.rotation.x = Math.PI / 2;
    zHead.position.z = axisLength + arrowHeadLength / 2;
    
    zAxisGroup.add(zArrow);
    zAxisGroup.add(zHead);
    gizmoScene.add(zAxisGroup);

    // Store references for rotation updates
    gizmoScene.userData.xAxis = xAxisGroup;
    gizmoScene.userData.yAxis = yAxisGroup;
    gizmoScene.userData.zAxis = zAxisGroup;
}

function updateGizmoOrientation() {
    if (!gizmoScene) return;
    
    // Create a rotation matrix that matches the main camera's orientation
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Set gizmo camera to look from the same direction as main camera
    gizmoCamera.position.copy(cameraDirection).multiplyScalar(-5);
    gizmoCamera.lookAt(0, 0, 0);
}

async function loadCSVData() {
    try {
        const response = await fetch(`${currentDataset}?v=${Date.now()}`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        
        const lines = csvText.trim().split('\n');
        
        // Extract point counts from first line
        const firstLine = lines[0].split(',').map(Number);
        totalFrames = firstLine.length;
        const pointsPerFrame = firstLine; // Array of point counts for each frame
        maxPoints = Math.max(...pointsPerFrame);
        
        console.log(`Found ${totalFrames} frames with point counts:`, pointsPerFrame);
        
        // Clear existing data
        pointsData = [];
        typeData = [];
        
        // Check if we have type data by examining the first data line
        if (lines.length > 1) {
            const sampleLine = lines[1];
            const sampleCoords = sampleLine.split(',');
            hasTypeData = sampleCoords.length >= 4; // x, y, z, and possibly type
            
            // DEBUG: Log the first few lines to see the format
            console.log('First data line:', sampleLine);
            console.log('Sample coords:', sampleCoords);
            console.log('Number of columns:', sampleCoords.length);
        } else {
            hasTypeData = false;
        }
        
        console.log(`Dataset ${currentDataset} has type data: ${hasTypeData}`);
        
        // Parse CSV data into frames (skip first line)
        let lineIndex = 1; // Start from second line
        for (let frame = 0; frame < totalFrames; frame++) {
            const frameData = [];
            const frameTypes = [];
            const pointCount = pointsPerFrame[frame];
            
            for (let point = 0; point < pointCount; point++) {
                if (lineIndex < lines.length) {
                    const coords = lines[lineIndex].split(',').map(Number);
                    frameData.push(coords[0], coords[1], coords[2]); // x, y, z
                    
                    if (hasTypeData && coords.length >= 4) {
                        frameTypes.push(coords[3]); // type
                    } else {
                        frameTypes.push(0); // default type
                    }
                    lineIndex++;
                }
            }
            pointsData.push(frameData);
            typeData.push(frameTypes);
        }
        
        console.log(`Loaded ${pointsData.length} frames with varying point counts`);
        
        // Update UI with actual data
        document.querySelector('#info div:first-child').textContent = `Max Points: ${maxPoints}`;
        document.querySelector('#info div:nth-child(2)').textContent = `Total Frames: ${totalFrames}`;
        
        // Update color button visibility and state
        console.log('Setting color button visibility to:', hasTypeData ? 'visible' : 'hidden');
        colorToggleBtn.style.display = hasTypeData ? 'inline-block' : 'none';
        colorToggleBtn.classList.remove('active');
        colorByType = false;
        
        // Update slider max value and reset to frame 0
        timeSlider.max = totalFrames - 1;
        currentFrame = 0;
        timeSlider.value = 0;
        
        // Reset playback
        isPlaying = false;
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        
        createPointCloud();
        
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert(`Error loading ${currentDataset} file. Make sure it exists in the same directory.`);
    }
}

function createPointCloud() {
    if (pointsData.length === 0) return;

    // Remove existing points
    if (points) {
        scene.remove(points);
    }

    // Create instanced mesh for spheres - Ultra lightweight for smooth rotation
    const sphereGeometry = new THREE.SphereGeometry(1.5, 6, 4); // Very low poly for performance
    const sphereMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x888888, // Default grey color
    });

    points = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, maxPoints);
    
    // DEBUG: Check if instanceColor is supported
    console.log('Three.js version supports instanceColor:', !!points.instanceColor);
    
    // Enable instance color support - this might be the issue
    points.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxPoints * 3), 3);
    
    // Initialize all colors to white/grey to test
    const defaultColor = new THREE.Color(0x888888);
    for (let i = 0; i < maxPoints; i++) {
        points.setColorAt(i, defaultColor);
    }
    points.instanceColor.needsUpdate = true;
    
    console.log('Created point cloud with', maxPoints, 'instances');
    console.log('instanceColor attribute created:', !!points.instanceColor);
    
    // Set initial positions and colors
    updateInstancedMeshPositions(0);
    
    scene.add(points);

    updateFrameDisplay();
}

function updateInstancedMeshPositions(frame) {
    if (!points || !pointsData[frame]) return;
    
    const frameData = pointsData[frame];
    const frameTypes = typeData[frame] || [];
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    let visibleCount = 0;
    
    const currentFramePointCount = frameData.length / 3; // Each point has x,y,z
    
    for (let i = 0; i < currentFramePointCount; i++) {
        const x = frameData[i * 3];
        const y = frameData[i * 3 + 1];
        const z = frameData[i * 3 + 2];
        
        // Rotate 90 degrees around X-axis: (x, y, z) -> (x, -z, y)
        const rotatedX = -x;
        const rotatedY = z;
        const rotatedZ = y;
        
        // Check cross-section visibility
        let isVisible = true;
        if (crossSectionMode === 'horizontal') {
            // Show only points where X > 0 (horizontal cross-section)
            isVisible = rotatedX < 0;
        } else if (crossSectionMode === 'vertical') {
            // Show only points where Z > 0 (vertical cross-section)
            isVisible = rotatedZ > 0;
        }
        
        if (isVisible) {
            matrix.setPosition(rotatedX, rotatedY, rotatedZ);
            points.setMatrixAt(visibleCount, matrix);
            
            // Set color based on type if enabled
            if (colorByType && hasTypeData && frameTypes[i] !== undefined) {
                const typeIndex = frameTypes[i] % typeColors.length;
                color.setHex(typeColors[typeIndex]);
            } else {
                color.setHex(0x888888); // Default grey
            }
            points.setColorAt(visibleCount, color);
            
            visibleCount++;
        }
    }
    
    // Hide remaining instances by setting them far away
    const hiddenMatrix = new THREE.Matrix4();
    hiddenMatrix.setPosition(10000, 10000, 10000); // Far away position
    const hiddenColor = new THREE.Color(0x888888);
    for (let i = visibleCount; i < maxPoints; i++) {
        points.setMatrixAt(i, hiddenMatrix);
        points.setColorAt(i, hiddenColor);
    }
    
    points.instanceMatrix.needsUpdate = true;
    if (points.instanceColor) {
        points.instanceColor.needsUpdate = true;
    }
}

function updateFrame(frame) {
    if (!points || !pointsData[frame]) return;
    
    updateInstancedMeshPositions(frame);
    
    currentFrame = frame;
    timeSlider.value = frame;
    updateFrameDisplay();
}

function updateFrameDisplay() {
    frameLabel.textContent = `${currentFrame + 1} / ${totalFrames}`;
}

function setupEventListeners() {
    datasetSelect.addEventListener('change', (e) => {
        currentDataset = e.target.value;
        loadCSVData();
    });

    playBtn.addEventListener('click', () => {
        isPlaying = true;
        playBtn.disabled = true;
        pauseBtn.disabled = false;
    });

    pauseBtn.addEventListener('click', () => {
        isPlaying = false;
        playBtn.disabled = false;
        pauseBtn.disabled = true;
    });

    resetBtn.addEventListener('click', () => {
        currentFrame = 0;
        if (points && pointsData.length > 0) {
            updateInstancedMeshPositions(0);
        }
        updateFrameDisplay();
        isPlaying = false;
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        
        // Reset camera position and controls
        camera.position.set(0, 0, 120);
        controls.target.set(0, 0, 0);
        controls.update();
    });

    timeSlider.addEventListener('input', (e) => {
        currentFrame = parseInt(e.target.value);
        updateFrame(currentFrame);
    });

    speedSlider.addEventListener('input', (e) => {
        animationSpeed = parseFloat(e.target.value);
        speedLabel.textContent = `${animationSpeed.toFixed(1)}x`;
    });

    // Cross-section buttons
    fullBtn.addEventListener('click', () => {
        setCrossSectionMode('full');
    });

    horizontalBtn.addEventListener('click', () => {
        setCrossSectionMode('horizontal');
    });

    verticalBtn.addEventListener('click', () => {
        setCrossSectionMode('vertical');
    });

    // Color toggle button
    colorToggleBtn.addEventListener('click', () => {
        colorByType = !colorByType;
        colorToggleBtn.classList.toggle('active', colorByType);
        
        // Update the current frame to apply the color changes
        if (points && pointsData.length > 0) {
            updateInstancedMeshPositions(currentFrame);
        }
    });

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function setCrossSectionMode(mode) {
    crossSectionMode = mode;
    
    // Update button states
    fullBtn.classList.toggle('active', mode === 'full');
    horizontalBtn.classList.toggle('active', mode === 'horizontal');
    verticalBtn.classList.toggle('active', mode === 'vertical');
    
    // Update the current frame to apply the cross-section
    if (points && pointsData.length > 0) {
        updateInstancedMeshPositions(currentFrame);
    }
}

function animate(time = 0) {
    requestAnimationFrame(animate);

    // No need to update controls since damping is disabled for better performance

    // Animation logic
    if (isPlaying && pointsData.length > 0) {
        const deltaTime = time - lastTime;
        if (deltaTime >= (2000 / (20 * animationSpeed))) { // 20 FPS for better performance
            currentFrame = (currentFrame + 1) % pointsData.length;
            updateFrame(currentFrame);
            lastTime = time;
        }
    }

    renderer.render(scene, camera);
    
    // Render the orientation gizmo
    if (gizmoRenderer && gizmoScene && gizmoCamera) {
        gizmoRenderer.render(gizmoScene, gizmoCamera);
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    console.log('Running on iOS:', isIOS);
    
    // Add iOS-specific handling
    if (isIOS) {
        // Reduce quality for iOS
        // maxPoints = Math.min(maxPoints, 2000); // Further reduced for iOS smooth performance
        console.log('iOS detected: reducing max points to', maxPoints);
    }
    
    try {
        init();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize 3D visualization. Your device may not support WebGL.');
    }
});