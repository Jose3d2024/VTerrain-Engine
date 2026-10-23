import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  TerrainDataMap,
  RenderStyle,
  ViewportSettings,
} from '../types/terrain';
import {
  Layers,
  Camera,
  Compass,
  Eye,
  RefreshCw,
  Box,
  RotateCcw,
} from 'lucide-react';

interface Viewport3DProps {
  dataMap: TerrainDataMap;
  settings: ViewportSettings;
  onUpdateSettings: (newSettings: Partial<ViewportSettings>) => void;
  onSculptHeightmap?: (newHeightmap: Float32Array) => void;
  isBaking?: boolean;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  dataMap,
  settings,
  onUpdateSettings,
  onSculptHeightmap,
  isBaking = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const oceanMeshRef = useRef<THREE.Mesh | null>(null);
  const slabMeshRef = useRef<THREE.Mesh | null>(null);
  const brushHelperRef = useRef<THREE.Mesh | null>(null);

  const dataTextureRef = useRef<THREE.DataTexture | null>(null);
  const colorTextureRef = useRef<THREE.DataTexture | null>(null);
  const shaderMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const oceanMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const slabMatRef = useRef<THREE.ShaderMaterial | null>(null);

  const animFrameRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());

  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // Sculpting Raycasting
  const isSculptingRef = useRef(false);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseVecRef = useRef(new THREE.Vector2());

  const hexToVec3 = (hex: string): THREE.Vector3 => {
    const c = new THREE.Color(hex);
    return new THREE.Vector3(c.r, c.g, c.b);
  };

  const getRenderStyleIndex = (style: RenderStyle): number => {
    switch (style) {
      case 'pbr': return 0;
      case 'clay': return 1;
      case 'satmap': return 2;
      case 'height': return 3;
      case 'flow': return 4;
      case 'deposition': return 5;
      case 'wear': return 6;
      case 'normals': return 7;
      default: return 0;
    }
  };

  // Update DataTexture & ColorTexture
  const updateDataTexture = useCallback(() => {
    if (!dataMap || dataMap.width === 0 || dataMap.height === 0) return;

    const { width, height, heightmap, flowmap, deposition, wear, colorMap } = dataMap;
    const size = width * height;
    const rgbaData = new Uint8Array(size * 4);

    for (let i = 0; i < size; i++) {
      const idx = i * 4;
      rgbaData[idx] = Math.floor(Math.min(1, Math.max(0, heightmap[i])) * 255);
      rgbaData[idx + 1] = Math.floor(Math.min(1, Math.max(0, flowmap[i])) * 255);
      rgbaData[idx + 2] = Math.floor(Math.min(1, Math.max(0, deposition[i])) * 255);
      rgbaData[idx + 3] = Math.floor(Math.min(1, Math.max(0, wear[i])) * 255);
    }

    if (
      !dataTextureRef.current ||
      dataTextureRef.current.image.width !== width ||
      dataTextureRef.current.image.height !== height
    ) {
      if (dataTextureRef.current) dataTextureRef.current.dispose();
      const texture = new THREE.DataTexture(
        rgbaData,
        width,
        height,
        THREE.RGBAFormat,
        THREE.UnsignedByteType
      );
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      dataTextureRef.current = texture;

      if (shaderMatRef.current) {
        shaderMatRef.current.uniforms.uDataMap.value = texture;
        shaderMatRef.current.uniforms.uResolution.value.set(width, height);
      }
      if (oceanMatRef.current) {
        oceanMatRef.current.uniforms.uDataMap.value = texture;
      }
    } else if (dataTextureRef.current.image && dataTextureRef.current.image.data) {
      (dataTextureRef.current.image.data as Uint8Array).set(rgbaData);
      dataTextureRef.current.needsUpdate = true;
    }

    if (colorMap) {
      if (
        !colorTextureRef.current ||
        colorTextureRef.current.image.width !== width ||
        colorTextureRef.current.image.height !== height
      ) {
        if (colorTextureRef.current) colorTextureRef.current.dispose();
        const colTex = new THREE.DataTexture(
          colorMap,
          width,
          height,
          THREE.RGBAFormat,
          THREE.UnsignedByteType
        );
        colTex.minFilter = THREE.LinearFilter;
        colTex.magFilter = THREE.LinearFilter;
        colTex.wrapS = THREE.ClampToEdgeWrapping;
        colTex.wrapT = THREE.ClampToEdgeWrapping;
        colTex.needsUpdate = true;
        colorTextureRef.current = colTex;

        if (shaderMatRef.current) {
          shaderMatRef.current.uniforms.uColorMap.value = colTex;
          shaderMatRef.current.uniforms.uHasColorMap.value = 1.0;
        }
      } else if (colorTextureRef.current.image && colorTextureRef.current.image.data) {
        (colorTextureRef.current.image.data as Uint8Array).set(colorMap);
        colorTextureRef.current.needsUpdate = true;
      }
    } else if (shaderMatRef.current) {
      shaderMatRef.current.uniforms.uHasColorMap.value = 0.0;
    }
  }, [dataMap]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111316);
    scene.fog = new THREE.FogExp2(0x111316, settings.lighting.fogDensity ?? 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      250
    );
    camera.position.set(16, 12, 16);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 2.0;
    controls.maxDistance = 80.0;
    controls.target.set(0, 1.5, 0);
    controlsRef.current = controls;

    // Atmospheric Sky Lighting (High-fidelity Hemisphere + Directional)
    const hemiLight = new THREE.HemisphereLight(0x9bc2ea, 0x3a3328, 1.0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff6e8, 2.8);
    dirLight.position.set(15, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Warm bounced light from the opposite horizon
    const bounceLight = new THREE.DirectionalLight(0x507090, 0.7);
    bounceLight.position.set(-15, 8, -12);
    scene.add(bounceLight);

    // High-Fidelity Terrain Shader (Substance Painter & World Creator grade)
    const terrainVertexShader = `
      uniform sampler2D uDataMap;
      uniform vec2 uResolution;
      uniform float uHeightScale;

      varying vec2 vUv;
      varying float vHeight;
      varying float vFlow;
      varying float vDeposition;
      varying float vWear;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 data = texture2D(uDataMap, uv);
        vHeight = data.r;
        vFlow = data.g;
        vDeposition = data.b;
        vWear = data.a;

        vec3 displacedPos = position;
        displacedPos.y = data.r * uHeightScale;

        // Smooth Central Difference Normal Computation
        vec2 texel = 1.0 / uResolution;
        float hL = texture2D(uDataMap, uv - vec2(texel.x, 0.0)).r * uHeightScale;
        float hR = texture2D(uDataMap, uv + vec2(texel.x, 0.0)).r * uHeightScale;
        float hD = texture2D(uDataMap, uv - vec2(0.0, texel.y)).r * uHeightScale;
        float hU = texture2D(uDataMap, uv + vec2(0.0, texel.y)).r * uHeightScale;

        float worldStepX = 20.0 * texel.x;
        float worldStepZ = 20.0 * texel.y;

        vec3 normal = normalize(vec3(
          (hL - hR) / (2.0 * worldStepX),
          1.0,
          (hD - hU) / (2.0 * worldStepZ)
        ));
        vNormal = normal;

        vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
        vWorldPosition = worldPos.xyz;

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const terrainFragmentShader = `
      precision highp float;

      uniform int uRenderStyle;
      uniform sampler2D uColorMap;
      uniform float uHasColorMap;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;
      uniform vec3 uCameraPos;
      uniform float uSunIntensity;
      uniform float uExposure;
      uniform float uContrast;

      // Substance Painter / World Creator PBR Layers
      uniform vec3 uRockColor;
      uniform float uRockRoughness;
      uniform vec3 uScreeColor;
      uniform float uScreeRoughness;
      uniform vec3 uGrassColor;
      uniform float uGrassRoughness;
      uniform vec3 uSnowColor;
      uniform float uSnowRoughness;
      uniform float uSnowHeight;
      uniform vec3 uWaterColor;
      uniform float uNormalStrength;
      uniform float uTriplanarScale;
      uniform float uAmbientOcclusion;

      varying vec2 vUv;
      varying float vHeight;
      varying float vFlow;
      varying float vDeposition;
      varying float vWear;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      // Procedural micro-normals for granite rock, gravel, and grass
      vec3 getMicroNormal(vec3 worldPos, vec3 geomNormal, float slope) {
        float scale = uTriplanarScale * 6.0;
        float n1 = sin(worldPos.x * scale) * cos(worldPos.z * scale);
        float n2 = sin(worldPos.x * scale * 2.3 + 1.2) * cos(worldPos.z * scale * 2.3);
        float microNoise = (n1 + n2 * 0.5) * uNormalStrength * 0.14;

        // Rock cliff striations
        float cliffStriation = sin(worldPos.y * scale * 4.0) * slope * uNormalStrength * 0.16;

        vec3 perturbed = geomNormal;
        perturbed.x += microNoise + cliffStriation * 0.6;
        perturbed.z += microNoise;
        return normalize(perturbed);
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(uCameraPos - vWorldPosition);
        vec3 H = normalize(L + V);

        float slope = 1.0 - max(0.0, dot(N, vec3(0.0, 1.0, 0.0)));
        vec3 detailedN = getMicroNormal(vWorldPosition, N, slope);

        // Render Style 1: Gaea Clay Mode
        if (uRenderStyle == 1) {
          vec3 clayBase = vec3(0.74, 0.70, 0.65);
          float NdotL = max(0.0, dot(detailedN, L));
          float diffuse = pow(NdotL * 0.7 + 0.3, 1.3);
          float ao = 1.0 - smoothstep(0.3, 0.8, vWear) * 0.35 * uAmbientOcclusion;
          float rim = pow(1.0 - max(0.0, dot(N, V)), 3.0) * 0.28;
          vec3 direct = clayBase * diffuse * uSunIntensity;
          vec3 col = (clayBase * 0.45 * ao + direct + rim) * uExposure;
          gl_FragColor = vec4(col, 1.0);
          return;
        }

        // Diagnostic Views
        if (uRenderStyle == 3) {
          float contour = smoothstep(0.02, 0.0, abs(fract(vHeight * 24.0) - 0.5));
          vec3 col = vec3(vHeight) + vec3(0.0, 0.3, 0.6) * contour * 0.5;
          gl_FragColor = vec4(col, 1.0);
          return;
        }

        if (uRenderStyle == 4) {
          vec3 baseRock = vec3(0.08, 0.09, 0.11);
          vec3 flowCol = vec3(0.0, 0.75, 1.0);
          vec3 col = mix(baseRock, flowCol, pow(vFlow, 0.8));
          gl_FragColor = vec4(col, 1.0);
          return;
        }

        if (uRenderStyle == 5) {
          vec3 baseBedrock = vec3(0.12, 0.13, 0.15);
          vec3 sedimentCol = vec3(0.88, 0.64, 0.34);
          vec3 col = mix(baseBedrock, sedimentCol, pow(vDeposition, 0.85));
          gl_FragColor = vec4(col, 1.0);
          return;
        }

        if (uRenderStyle == 6) {
          vec3 baseCol = vec3(0.15, 0.15, 0.17);
          vec3 wearCol = vec3(0.95, 0.22, 0.28);
          vec3 col = mix(baseCol, wearCol, pow(vWear, 0.8));
          gl_FragColor = vec4(col, 1.0);
          return;
        }

        if (uRenderStyle == 7) {
          gl_FragColor = vec4(detailedN * 0.5 + 0.5, 1.0);
          return;
        }

        // Render Style 2: SatMap
        if (uRenderStyle == 2 && uHasColorMap > 0.5) {
          vec3 satAlbedo = texture2D(uColorMap, vUv).rgb;
          float NdotL = max(0.0, dot(detailedN, L));
          float diffuse = pow(NdotL * 0.7 + 0.3, 1.2);
          vec3 col = (uAmbientColor * satAlbedo * 1.2 + uSunColor * satAlbedo * diffuse * uSunIntensity) * uExposure;
          gl_FragColor = vec4(col, 1.0);
          return;
        }

        // Mode 0: Substance 3D Painter & World Machine Multi-Layer PBR
        // 1. Base Alpine Grassland / Valley Meadow
        vec3 albedo = uGrassColor;
        float roughness = uGrassRoughness;

        // 2. Alluvial Scree & Talus Gravel in depressions and valleys
        float screeWeight = smoothstep(0.12, 0.52, vDeposition) * (1.0 - smoothstep(0.38, 0.78, slope));
        albedo = mix(albedo, uScreeColor, screeWeight);
        roughness = mix(roughness, uScreeRoughness, screeWeight);

        // 3. Exposed Steep Bedrock & Cliff Granite (Slope & Wear rule)
        float cliffWeight = smoothstep(0.24, 0.58, max(slope, vWear));
        albedo = mix(albedo, uRockColor, cliffWeight);
        roughness = mix(roughness, uRockRoughness, cliffWeight);

        // Dark basalt fracture bands on extreme wear
        float basaltWeight = smoothstep(0.65, 0.95, vWear) * cliffWeight;
        albedo = mix(albedo, uRockColor * 0.6, basaltWeight);

        // 4. Glacial Runoff & Wet Riverbed Veins (Flow rule)
        float flowWeight = smoothstep(0.28, 0.72, vFlow) * (1.0 - cliffWeight * 0.5);
        albedo = mix(albedo, uWaterColor, flowWeight);
        roughness = mix(roughness, 0.12, flowWeight);

        // 5. Alpine Snowcap & Frost (Height & Slope rule)
        float snowLine = uSnowHeight;
        float snowWeight = smoothstep(snowLine, snowLine + 0.15, vHeight) * (1.0 - smoothstep(0.48, 0.80, slope));
        albedo = mix(albedo, uSnowColor, snowWeight);
        roughness = mix(roughness, uSnowRoughness, snowWeight);

        // Geological horizontal strata banding
        float strata = sin(vWorldPosition.y * 14.0) * 0.5 + 0.5;
        albedo *= (0.93 + strata * 0.12);

        // Natural Sun Lighting with Bounced Sky Ambient (prevents muddy black shadows)
        float NdotL = max(0.0, dot(detailedN, L));
        float directDiffuse = pow(NdotL * 0.75 + 0.25, 1.25);

        // GGX-like Specular Highlights
        float NdotH = max(0.0, dot(detailedN, H));
        float specPower = mix(16.0, 96.0, 1.0 - roughness);
        float specular = pow(NdotH, specPower) * (1.0 - roughness) * (flowWeight > 0.3 ? 0.8 : 0.4);

        // Cavity Ambient Occlusion in deep crevasses
        float ao = 1.0 - smoothstep(0.35, 0.9, vWear) * 0.45 * uAmbientOcclusion;

        // Rim Lighting on Mountain Silhouettes
        float rim = pow(1.0 - max(0.0, dot(N, V)), 3.5) * 0.25 * (1.0 - cliffWeight * 0.3);

        vec3 ambient = uAmbientColor * albedo * ao * 1.35;
        vec3 direct = uSunColor * albedo * directDiffuse * uSunIntensity + uSunColor * specular * uSunIntensity;
        vec3 finalColor = (ambient + direct + rim * uSunColor) * uExposure;

        // Contrast adjustment
        finalColor = pow(finalColor, vec3(uContrast));

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        uDataMap: { value: null },
        uColorMap: { value: null },
        uHasColorMap: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(256, 256) },
        uHeightScale: { value: settings.heightScale },
        uRenderStyle: { value: getRenderStyleIndex(settings.renderStyle) },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
        uSunColor: { value: new THREE.Color(settings.lighting.sunColor || '#fff6e8') },
        uAmbientColor: { value: new THREE.Color(settings.lighting.skyColor || '#6c8bb0') },
        uCameraPos: { value: camera.position },
        uSunIntensity: { value: settings.lighting.sunIntensity ?? 2.6 },
        uExposure: { value: settings.lighting.exposure ?? 1.35 },
        uContrast: { value: settings.lighting.contrast ?? 1.02 },

        // PBR Layer Uniforms
        uRockColor: { value: hexToVec3(settings.pbr.rockColor) },
        uRockRoughness: { value: settings.pbr.rockRoughness },
        uScreeColor: { value: hexToVec3(settings.pbr.screeColor) },
        uScreeRoughness: { value: settings.pbr.screeRoughness },
        uGrassColor: { value: hexToVec3(settings.pbr.grassColor) },
        uGrassRoughness: { value: settings.pbr.grassRoughness },
        uSnowColor: { value: hexToVec3(settings.pbr.snowColor) },
        uSnowRoughness: { value: settings.pbr.snowRoughness },
        uSnowHeight: { value: settings.pbr.snowHeight },
        uWaterColor: { value: hexToVec3(settings.pbr.waterColor) },
        uNormalStrength: { value: settings.pbr.normalStrength },
        uTriplanarScale: { value: settings.pbr.triplanarScale },
        uAmbientOcclusion: { value: settings.pbr.ambientOcclusion },
      },
      wireframe: settings.wireframe,
      side: THREE.DoubleSide,
    });
    shaderMatRef.current = shaderMaterial;

    // Terrain Plane
    const planeGeo = new THREE.PlaneGeometry(20, 20, settings.meshDensity || 256, settings.meshDensity || 256);
    planeGeo.rotateX(-Math.PI / 2);
    const terrainMesh = new THREE.Mesh(planeGeo, shaderMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // Advanced Ocean Shader with Gerstner Waves & Dynamic Shoreline Foam
    const oceanVertexShader = `
      uniform float uTime;
      uniform float uWaveSpeed;
      uniform float uWaveHeight;
      uniform float uWaterLevel;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Two animated wave components
        float w1 = sin(pos.x * 1.8 + uTime * uWaveSpeed) * cos(pos.z * 1.8 + uTime * uWaveSpeed) * uWaveHeight;
        float w2 = sin(pos.x * 3.6 - uTime * uWaveSpeed * 1.3 + 0.5) * cos(pos.z * 3.6 + uTime * uWaveSpeed * 1.3) * (uWaveHeight * 0.45);

        pos.y = uWaterLevel + w1 + w2;

        // Analytical wave normal
        float dwdx = cos(pos.x * 1.8 + uTime * uWaveSpeed) * 1.8 * cos(pos.z * 1.8 + uTime * uWaveSpeed) * uWaveHeight;
        float dwdz = -sin(pos.x * 1.8 + uTime * uWaveSpeed) * sin(pos.z * 1.8 + uTime * uWaveSpeed) * 1.8 * uWaveHeight;
        vNormal = normalize(vec3(-dwdx, 1.0, -dwdz));

        vec4 worldP = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldP.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldP;
      }
    `;

    const oceanFragmentShader = `
      precision highp float;

      uniform sampler2D uDataMap;
      uniform float uHeightScale;
      uniform float uWaterLevel;
      uniform vec3 uShallowColor;
      uniform vec3 uDeepColor;
      uniform vec3 uFoamColor;
      uniform float uFoamThreshold;
      uniform float uOpacity;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uCameraPos;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunDirection);
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 H = normalize(L + V);

        // Sample terrain height beneath this water position
        float terrainH = texture2D(uDataMap, vUv).r * uHeightScale;
        float depth = max(0.0, uWaterLevel - terrainH);

        // Water depth color transition: Shallow Turquoise -> Deep Navy
        float depthFactor = smoothstep(0.0, 1.2, depth);
        vec3 waterCol = mix(uShallowColor, uDeepColor, depthFactor);

        // Shoreline Foam where water meets terrain
        float foam = smoothstep(uFoamThreshold, 0.0, depth);
        // Dynamic turbulent foam pattern
        float foamNoise = sin(vWorldPos.x * 14.0 + uTime * 3.0) * cos(vWorldPos.z * 14.0 - uTime * 2.0);
        foam = clamp(foam + foamNoise * 0.25 * foam, 0.0, 1.0);

        vec3 surfaceCol = mix(waterCol, uFoamColor, foam);

        // Sun Specular Shimmer / Glint
        float NdotL = max(0.0, dot(N, L));
        float NdotH = max(0.0, dot(N, H));
        float specular = pow(NdotH, 128.0) * 0.95;

        // Fresnel reflection
        float fresnel = pow(1.0 - max(0.0, dot(N, V)), 4.0) * 0.45;
        vec3 skyReflect = vec3(0.55, 0.72, 0.95) * fresnel;

        vec3 finalCol = surfaceCol * (NdotL * 0.7 + 0.3) + uSunColor * specular + skyReflect;
        float alpha = mix(uOpacity * 0.7, 1.0, max(depthFactor, foam));

        gl_FragColor = vec4(finalCol, alpha);
      }
    `;

    const oceanMaterial = new THREE.ShaderMaterial({
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      uniforms: {
        uDataMap: { value: null },
        uHeightScale: { value: settings.heightScale },
        uWaterLevel: { value: settings.ocean.waterLevel * settings.heightScale },
        uShallowColor: { value: hexToVec3(settings.ocean.shallowColor || '#26a8b8') },
        uDeepColor: { value: hexToVec3(settings.ocean.deepColor || '#0a2342') },
        uFoamColor: { value: hexToVec3(settings.ocean.foamColor || '#eef8ff') },
        uFoamThreshold: { value: settings.ocean.foamThreshold || 0.12 },
        uOpacity: { value: settings.ocean.opacity || 0.88 },
        uWaveSpeed: { value: settings.ocean.waveSpeed || 1.4 },
        uWaveHeight: { value: settings.ocean.waveHeight || 0.06 },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
        uSunColor: { value: new THREE.Color(settings.lighting.sunColor || '#fff6e8') },
        uCameraPos: { value: camera.position },
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    oceanMatRef.current = oceanMaterial;

    const oceanGeo = new THREE.PlaneGeometry(20.4, 20.4, 64, 64);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMaterial);
    oceanMesh.visible = settings.ocean.enabled;
    scene.add(oceanMesh);
    oceanMeshRef.current = oceanMesh;

    // 3D Geological Cut Slab
    const slabGeo = new THREE.BoxGeometry(20, 3, 20);
    const slabShaderMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        uniform vec3 uSunDirection;
        void main() {
          float strata = sin(vWorldPos.y * 12.0) * 0.5 + 0.5;
          float subStrata = sin(vWorldPos.y * 36.0) * 0.5 + 0.5;
          vec3 layer1 = vec3(0.24, 0.22, 0.20);
          vec3 layer2 = vec3(0.38, 0.32, 0.28);
          vec3 col = mix(layer1, layer2, strata * 0.7 + subStrata * 0.3);

          float diffuse = max(0.0, dot(vNormal, normalize(uSunDirection))) * 0.6 + 0.4;
          gl_FragColor = vec4(col * diffuse, 1.0);
        }
      `,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
      },
    });
    slabMatRef.current = slabShaderMat;

    const slabMesh = new THREE.Mesh(slabGeo, slabShaderMat);
    slabMesh.position.y = -1.5;
    slabMesh.visible = settings.solidSlab;
    scene.add(slabMesh);
    slabMeshRef.current = slabMesh;

    // Brush Ring Helper
    const ringGeo = new THREE.RingGeometry(0.3, 0.35, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00a8ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const brushHelper = new THREE.Mesh(ringGeo, ringMat);
    brushHelper.visible = false;
    scene.add(brushHelper);
    brushHelperRef.current = brushHelper;

    const gridHelper = new THREE.GridHelper(26, 26, 0x00a8ff, 0x22262e);
    gridHelper.position.y = -0.02;
    scene.add(gridHelper);

    // Animation Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      frameCountRef.current++;
      const now = performance.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      const elapsed = clockRef.current.getElapsedTime();

      if (shaderMatRef.current) {
        shaderMatRef.current.uniforms.uCameraPos.value.copy(camera.position);
      }
      if (oceanMatRef.current) {
        oceanMatRef.current.uniforms.uTime.value = elapsed;
        oceanMatRef.current.uniforms.uCameraPos.value.copy(camera.position);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
      planeGeo.dispose();
      oceanGeo.dispose();
      slabGeo.dispose();
      ringGeo.dispose();
      shaderMaterial.dispose();
      oceanMaterial.dispose();
      slabShaderMat.dispose();
      if (dataTextureRef.current) dataTextureRef.current.dispose();
      if (colorTextureRef.current) colorTextureRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    updateDataTexture();
  }, [updateDataTexture]);

  // Update uniforms when settings change
  useEffect(() => {
    if (!shaderMatRef.current) return;

    shaderMatRef.current.uniforms.uHeightScale.value = settings.heightScale;
    shaderMatRef.current.uniforms.uRenderStyle.value = getRenderStyleIndex(settings.renderStyle);
    shaderMatRef.current.uniforms.uSunIntensity.value = settings.lighting.sunIntensity ?? 2.6;
    shaderMatRef.current.uniforms.uExposure.value = settings.lighting.exposure ?? 1.35;
    shaderMatRef.current.uniforms.uContrast.value = settings.lighting.contrast ?? 1.02;
    shaderMatRef.current.wireframe = settings.wireframe;

    // Sun Vector
    const azRad = (settings.lighting.sunAzimuth * Math.PI) / 180;
    const elRad = (settings.lighting.sunElevation * Math.PI) / 180;
    const sunX = Math.cos(elRad) * Math.sin(azRad);
    const sunY = Math.sin(elRad);
    const sunZ = Math.cos(elRad) * Math.cos(azRad);
    const sunVec = new THREE.Vector3(sunX, sunY, sunZ).normalize();

    shaderMatRef.current.uniforms.uSunDirection.value.copy(sunVec);
    shaderMatRef.current.uniforms.uSunColor.value.set(settings.lighting.sunColor);
    shaderMatRef.current.uniforms.uAmbientColor.value.set(settings.lighting.skyColor);

    // PBR Layer Uniforms
    shaderMatRef.current.uniforms.uRockColor.value.copy(hexToVec3(settings.pbr.rockColor));
    shaderMatRef.current.uniforms.uRockRoughness.value = settings.pbr.rockRoughness;
    shaderMatRef.current.uniforms.uScreeColor.value.copy(hexToVec3(settings.pbr.screeColor));
    shaderMatRef.current.uniforms.uScreeRoughness.value = settings.pbr.screeRoughness;
    shaderMatRef.current.uniforms.uGrassColor.value.copy(hexToVec3(settings.pbr.grassColor));
    shaderMatRef.current.uniforms.uGrassRoughness.value = settings.pbr.grassRoughness;
    shaderMatRef.current.uniforms.uSnowColor.value.copy(hexToVec3(settings.pbr.snowColor));
    shaderMatRef.current.uniforms.uSnowRoughness.value = settings.pbr.snowRoughness;
    shaderMatRef.current.uniforms.uSnowHeight.value = settings.pbr.snowHeight;
    shaderMatRef.current.uniforms.uWaterColor.value.copy(hexToVec3(settings.pbr.waterColor));
    shaderMatRef.current.uniforms.uNormalStrength.value = settings.pbr.normalStrength;
    shaderMatRef.current.uniforms.uTriplanarScale.value = settings.pbr.triplanarScale;
    shaderMatRef.current.uniforms.uAmbientOcclusion.value = settings.pbr.ambientOcclusion;

    // Ocean Uniforms
    if (oceanMatRef.current) {
      oceanMatRef.current.uniforms.uHeightScale.value = settings.heightScale;
      oceanMatRef.current.uniforms.uWaterLevel.value = settings.ocean.waterLevel * settings.heightScale;
      oceanMatRef.current.uniforms.uShallowColor.value.copy(hexToVec3(settings.ocean.shallowColor));
      oceanMatRef.current.uniforms.uDeepColor.value.copy(hexToVec3(settings.ocean.deepColor));
      oceanMatRef.current.uniforms.uFoamColor.value.copy(hexToVec3(settings.ocean.foamColor));
      oceanMatRef.current.uniforms.uFoamThreshold.value = settings.ocean.foamThreshold;
      oceanMatRef.current.uniforms.uOpacity.value = settings.ocean.opacity;
      oceanMatRef.current.uniforms.uWaveSpeed.value = settings.ocean.waveSpeed;
      oceanMatRef.current.uniforms.uWaveHeight.value = settings.ocean.waveHeight;
      oceanMatRef.current.uniforms.uSunDirection.value.copy(sunVec);
      oceanMatRef.current.uniforms.uSunColor.value.set(settings.lighting.sunColor);
    }

    if (oceanMeshRef.current) {
      oceanMeshRef.current.visible = settings.ocean.enabled && settings.renderStyle !== 'clay';
    }

    if (slabMatRef.current) {
      slabMatRef.current.uniforms.uSunDirection.value.copy(sunVec);
    }

    if (slabMeshRef.current) {
      slabMeshRef.current.visible = settings.solidSlab;
    }

    if (sceneRef.current && sceneRef.current.fog) {
      (sceneRef.current.fog as THREE.FogExp2).density = settings.lighting.fogDensity;
    }
  }, [settings]);

  // Sculpting Raycasting
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!settings.brush.enabled) return;
    if (e.button !== 0) return;
    isSculptingRef.current = true;
    if (controlsRef.current) controlsRef.current.enabled = false;
    applySculpt(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !terrainMeshRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseVecRef.current.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouseVecRef.current.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseVecRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(terrainMeshRef.current);

    if (intersects.length > 0 && settings.brush.enabled) {
      const hit = intersects[0];
      if (brushHelperRef.current) {
        brushHelperRef.current.visible = true;
        brushHelperRef.current.position.copy(hit.point);
        brushHelperRef.current.position.y += 0.05;
        brushHelperRef.current.scale.set(
          settings.brush.radius * 3.0,
          settings.brush.radius * 3.0,
          settings.brush.radius * 3.0
        );
      }

      if (isSculptingRef.current) {
        applySculpt(e, hit.uv);
      }
    } else if (brushHelperRef.current) {
      brushHelperRef.current.visible = false;
    }
  };

  const handlePointerUp = () => {
    isSculptingRef.current = false;
    if (controlsRef.current) controlsRef.current.enabled = true;
  };

  const applySculpt = (e: React.PointerEvent, uvHit?: THREE.Vector2) => {
    if (!onSculptHeightmap || !dataMap || !dataMap.heightmap) return;
    const uv = uvHit || getUVFromMouse();
    if (!uv) return;

    const { width, height, heightmap } = dataMap;
    const centerX = Math.floor(uv.x * width);
    const centerY = Math.floor(uv.y * height);
    const brushPixelRadius = Math.max(2, Math.floor(settings.brush.radius * width * 0.2));
    const strength = settings.brush.strength * 0.04;
    const isShift = e.shiftKey;

    const newH = new Float32Array(heightmap);

    for (let dy = -brushPixelRadius; dy <= brushPixelRadius; dy++) {
      const y = centerY + dy;
      if (y < 0 || y >= height) continue;
      for (let dx = -brushPixelRadius; dx <= brushPixelRadius; dx++) {
        const x = centerX + dx;
        if (x < 0 || x >= width) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > brushPixelRadius) continue;

        const t = 1.0 - dist / brushPixelRadius;
        const falloff = t * t * (3.0 - 2.0 * t);
        const idx = y * width + x;

        switch (settings.brush.tool) {
          case 'raise':
            newH[idx] = Math.min(1.0, newH[idx] + (isShift ? -strength : strength) * falloff);
            break;
          case 'lower':
            newH[idx] = Math.max(0.0, newH[idx] - strength * falloff);
            break;
          case 'smooth': {
            let avg = 0;
            let count = 0;
            for (let sy = -1; sy <= 1; sy++) {
              for (let sx = -1; sx <= 1; sx++) {
                const ny = y + sy;
                const nx = x + sx;
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  avg += newH[ny * width + nx];
                  count++;
                }
              }
            }
            avg /= count;
            newH[idx] = newH[idx] * (1.0 - falloff * strength * 2.0) + avg * (falloff * strength * 2.0);
            break;
          }
          case 'flatten': {
            const targetH = 0.5;
            newH[idx] = newH[idx] * (1.0 - falloff * strength * 2.0) + targetH * (falloff * strength * 2.0);
            break;
          }
        }
      }
    }

    onSculptHeightmap(newH);
  };

  const getUVFromMouse = (): THREE.Vector2 | null => {
    if (!cameraRef.current || !terrainMeshRef.current) return null;
    raycasterRef.current.setFromCamera(mouseVecRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(terrainMeshRef.current);
    return intersects.length > 0 && intersects[0].uv ? intersects[0].uv : null;
  };

  const setCameraPreset = (view: 'perspective' | 'top' | 'low') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (view === 'perspective') {
      camera.position.set(16, 12, 16);
      controls.target.set(0, 1.5, 0);
    } else if (view === 'top') {
      camera.position.set(0, 24, 0.001);
      controls.target.set(0, 0, 0);
    } else if (view === 'low') {
      camera.position.set(12, 2.5, 12);
      controls.target.set(0, 2.0, 0);
    }
    controls.update();
  };

  const renderStyleButtons: { id: RenderStyle; label: string; badge: string }[] = [
    { id: 'pbr', label: 'PBR Shaded', badge: '1' },
    { id: 'clay', label: 'Gaea Clay', badge: '2' },
    { id: 'satmap', label: 'SatMap', badge: '3' },
    { id: 'height', label: 'Height (R)', badge: '4' },
    { id: 'flow', label: 'Flow (G)', badge: '5' },
    { id: 'deposition', label: 'Sediment', badge: '6' },
    { id: 'normals', label: 'Normals', badge: '7' },
  ];

  return (
    <div
      className="relative w-full h-full bg-[#111316] select-none overflow-hidden flex flex-col"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Clean Top Viewport Bar (Only Style Pills + 3D Slab + Wireframe) */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5 bg-[#17181B]/90 border border-[#2D3139] px-2 py-1.5 rounded-lg shadow-xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-1 mr-1 px-1 text-[11px] font-semibold text-neutral-400 tracking-wider uppercase font-mono">
            <Layers className="w-3.5 h-3.5 text-[#00A8FF]" />
            <span>Render</span>
          </div>

          {renderStyleButtons.map((btn) => {
            const isActive = settings.renderStyle === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => onUpdateSettings({ renderStyle: btn.id })}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  isActive
                    ? 'bg-[#00A8FF] text-white shadow-[0_0_12px_rgba(0,168,255,0.4)]'
                    : 'bg-[#1E2024] text-neutral-300 hover:bg-[#2A2E35] border border-transparent'
                }`}
              >
                <span>{btn.label}</span>
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-[#2D3139] mx-1" />

          {/* Solid 3D Slab */}
          <button
            onClick={() => onUpdateSettings({ solidSlab: !settings.solidSlab })}
            className={`px-2.5 py-1 text-xs rounded font-mono font-medium transition-all flex items-center gap-1.5 ${
              settings.solidSlab
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow'
                : 'bg-[#1E2024] text-neutral-400 hover:bg-[#2A2E35]'
            }`}
            title="3D Geological Strata Slab (World Machine Cutout Box)"
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D Slab</span>
          </button>

          {/* Wireframe */}
          <button
            onClick={() => onUpdateSettings({ wireframe: !settings.wireframe })}
            className={`px-2 py-1 text-xs rounded font-mono font-medium transition-all ${
              settings.wireframe
                ? 'bg-amber-500 text-black font-semibold'
                : 'bg-[#1E2024] text-neutral-400 hover:bg-[#2A2E35]'
            }`}
          >
            Wireframe
          </button>
        </div>

        {/* Viewport FPS & Resolution */}
        <div className="flex items-center gap-2 bg-[#17181B]/90 border border-[#2D3139] px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-md pointer-events-auto text-xs font-mono text-neutral-400">
          <span className="text-emerald-400 font-semibold">{fps} FPS</span>
          <span className="text-neutral-600">|</span>
          <span>{dataMap.width}x{dataMap.height}</span>
          {isBaking && (
            <div className="flex items-center gap-1 text-[#00A8FF] font-semibold animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Baking...</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Left: Clean Minimal Camera Dock */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-[#17181B]/90 border border-[#2D3139] p-1.5 rounded-lg shadow-xl backdrop-blur-md pointer-events-auto z-10">
        <button
          title="Perspective View"
          onClick={() => setCameraPreset('perspective')}
          className="p-1.5 hover:bg-[#2A2E35] rounded text-neutral-300 hover:text-white text-xs font-mono flex items-center gap-1"
        >
          <Camera className="w-3.5 h-3.5 text-[#00A8FF]" />
          <span>Persp</span>
        </button>
        <button
          title="Top-Down Orthographic View"
          onClick={() => setCameraPreset('top')}
          className="p-1.5 hover:bg-[#2A2E35] rounded text-neutral-300 hover:text-white text-xs font-mono flex items-center gap-1"
        >
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>Top</span>
        </button>
        <button
          title="Cinematic Low Horizon View"
          onClick={() => setCameraPreset('low')}
          className="p-1.5 hover:bg-[#2A2E35] rounded text-neutral-300 hover:text-white text-xs font-mono flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>Horizon</span>
        </button>
        <button
          title="Reset Camera"
          onClick={() => setCameraPreset('perspective')}
          className="p-1.5 hover:bg-[#2A2E35] rounded text-neutral-400 hover:text-white"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Bottom Right: Height Scale Displacement Slider */}
      <div className="absolute bottom-4 right-4 bg-[#17181B]/90 border border-[#2D3139] px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-md pointer-events-auto z-10 flex items-center gap-3">
        <span className="text-xs font-mono text-neutral-400">Scale:</span>
        <input
          type="range"
          min="1.0"
          max="8.0"
          step="0.1"
          value={settings.heightScale}
          onChange={(e) => onUpdateSettings({ heightScale: Number(e.target.value) })}
          className="w-24 h-1 bg-[#2D3139] rounded appearance-none cursor-pointer accent-[#00A8FF]"
        />
        <span className="text-xs font-mono text-[#00A8FF] w-8 font-semibold">
          {settings.heightScale.toFixed(1)}x
        </span>
      </div>
    </div>
  );
};
