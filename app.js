import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─── SCENE SETUP ───────────────────────────────────────────
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.5;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f1a);
scene.fog = new THREE.Fog(0x0f0f1a, 10, 50);

// ─── CAMERA ────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(3, 3, 5);

// ─── ORBIT CONTROLS ────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 20;

// ─── RESIZE ────────────────────────────────────────────────
function resizeRenderer() {
  const w = canvas.parentElement.clientWidth;
  const h = window.innerHeight * 0.88;
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  composer.setSize(w, h);
}
window.addEventListener('resize', resizeRenderer);

// ─── FLOOR ─────────────────────────────────────────────────
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.8, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(20, 20, 0x444466, 0x333355);
scene.add(grid);

// ─── LIGHTING ──────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
mainLight.position.set(5, 8, 5);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
scene.add(mainLight);

const spotlight = new THREE.SpotLight(0x00cfff, 2, 20, Math.PI / 6, 0.3);
spotlight.position.set(0, 8, 0);
spotlight.castShadow = true;
scene.add(spotlight);

const spotlightTarget = new THREE.Object3D();
scene.add(spotlightTarget);
spotlight.target = spotlightTarget;

// ─── GLSL SHADER OBJECT ────────────────────────────────────
// Custom shader plane representing a glowing monitor screen
const shaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0.0 },
    uColor: { value: new THREE.Color(0x00ff88) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
      // Pulsing glow effect
      float pulse = 0.5 + 0.5 * sin(uTime * 2.0);

      // Scanline effect
      float scanline = sin(vUv.y * 80.0 + uTime * 5.0) * 0.04;

      // Edge glow
      float edgeX = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
      float edgeY = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
      float edge = edgeX * edgeY;

      vec3 color = uColor * (pulse + scanline) * edge;
      gl_FragColor = vec4(color, 1.0);
    }
  `
});

const shaderScreen = new THREE.Mesh(
  new THREE.PlaneGeometry(0.8, 0.6),
  shaderMaterial
);
shaderScreen.position.set(0, 1.5, 0);
scene.add(shaderScreen);

// Label above shader screen
const shaderLabel = document.createElement('div');
shaderLabel.style.cssText = `
  position: absolute;
  color: #00ff88;
  font-size: 11px;
  font-family: monospace;
  pointer-events: none;
`;
shaderLabel.textContent = '[ GLSL Shader Screen ]';
document.body.appendChild(shaderLabel);

// ─── POST PROCESSING ───────────────────────────────────────
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,   // strength
  0.4,   // radius
  0.2    // threshold
);
composer.addPass(bloomPass);

// Now resize after composer is created
resizeRenderer();

// ─── LOADER ────────────────────────────────────────────────
const loader = new GLTFLoader();
const loadedModels = {};
let isAnimating = false;
let isWireframe = false;
let bloomEnabled = true;

const modelPositions = {
  bed:      new THREE.Vector3(0, 0, 0),
  monitor:  new THREE.Vector3(2.5, 0, 0),
  iv_stand: new THREE.Vector3(-2.5, 0, 0),
  chair:    new THREE.Vector3(1.5, 0, 2),
  cabinet:  new THREE.Vector3(-1.5, 0, 2)
};

// ─── LOAD MODEL ────────────────────────────────────────────
window.loadModel = function(name) {
  if (loadedModels[name]) { showInfo(name); return; }

  const infoBox = document.getElementById('model-info');
  infoBox.innerHTML = `⏳ Loading ${name}...`;

  loader.load(
    `models/${name}.glb`,
    function(gltf) {
      const model = gltf.scene;
      model.position.copy(modelPositions[name]);
      model.castShadow = true;
      model.receiveShadow = true;

      // Apply colors
      const colors = {
        bed:      [0xB0B0B0, 0xFFFFFF, 0xAED6F1],
        monitor:  [0x2C2C2C, 0x00FF88, 0xA0A0A0],
        iv_stand: [0xC0C0C0, 0xF5F5A0, 0x555555],
        chair:    [0x2E86C1, 0x2E86C1, 0xA8A8A8],
        cabinet:  [0xF0F0F0, 0xDCDCDC, 0xC0C0C0]
      };

      let colorIndex = 0;
      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const colorList = colors[name];
          const color = colorList[colorIndex % colorList.length];
          child.material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.6,
            metalness: 0.2
          });
          colorIndex++;
        }
      });

      scene.add(model);
      loadedModels[name] = model;
      fetchModelInfo(name);
    },
    function(progress) {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        infoBox.innerHTML = `⏳ Loading ${name}... ${pct}%`;
      }
    },
    function(error) {
      infoBox.innerHTML = `❌ Error loading ${name}.`;
      console.error(error);
    }
  );
};

// ─── FETCH MODEL INFO ──────────────────────────────────────
function fetchModelInfo(name) {
  fetch('data/models.json')
    .then(res => res.json())
    .then(data => {
      const item = data[name];
      document.getElementById('model-info').innerHTML =
        `<strong style="color:#00cfff; font-size:1rem;">${item.name}</strong>
         <br/><br/>${item.description}`;
    })
    .catch(() => {
      document.getElementById('model-info').innerHTML = '✅ Model loaded successfully.';
    });
}

function showInfo(name) { fetchModelInfo(name); }

// ─── CLEAR ─────────────────────────────────────────────────
window.clearModels = function() {
  for (const name in loadedModels) {
    scene.remove(loadedModels[name]);
    delete loadedModels[name];
  }
  document.getElementById('model-info').innerHTML = 'All models cleared.';
};

// ─── CAMERA PRESETS ────────────────────────────────────────
window.setCameraFront = function() {
  camera.position.set(0, 2, 7);
  controls.target.set(0, 1, 0);
  controls.update();
};

window.setCameraSide = function() {
  camera.position.set(7, 2, 0);
  controls.target.set(0, 1, 0);
  controls.update();
};

window.setCameraTop = function() {
  camera.position.set(0, 10, 0.01);
  controls.target.set(0, 0, 0);
  controls.update();
};

// ─── LIGHT TOGGLES ─────────────────────────────────────────
window.toggleLight = function() { mainLight.visible = !mainLight.visible; };
window.toggleSpotlight = function() { spotlight.visible = !spotlight.visible; };

// ─── WIREFRAME ─────────────────────────────────────────────
window.toggleWireframe = function() {
  isWireframe = !isWireframe;
  for (const name in loadedModels) {
    loadedModels[name].traverse(child => {
      if (child.isMesh) child.material.wireframe = isWireframe;
    });
  }
};

// ─── RESET ─────────────────────────────────────────────────
window.resetScene = function() {
  camera.position.set(3, 3, 5);
  controls.target.set(0, 0, 0);
  controls.update();
  isWireframe = false;
  isAnimating = false;
  for (const name in loadedModels) {
    loadedModels[name].traverse(child => {
      if (child.isMesh) child.material.wireframe = false;
    });
    loadedModels[name].rotation.y = 0;
  }
  mainLight.visible = true;
  spotlight.visible = true;
};

// ─── ANIMATION ─────────────────────────────────────────────
window.toggleAnimation = function() { isAnimating = !isAnimating; };

// ─── ANIMATE LOOP ──────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  // Update GLSL shader time uniform
  shaderMaterial.uniforms.uTime.value = elapsed;

  if (isAnimating) {
    for (const name in loadedModels) {
      loadedModels[name].rotation.y += 0.01;
    }
  }

  controls.update();
  composer.render();
}

animate();