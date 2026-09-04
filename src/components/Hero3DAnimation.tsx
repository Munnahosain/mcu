"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Box, Torus } from "@react-three/drei";
import * as THREE from "three";

// Floating Sphere with distortion
function FloatingSphere({ position, color, scale = 1, speed = 1 }: { position: [number, number, number], color: string, scale?: number, speed?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1 * speed;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15 * speed;
    }
  });

  return (
    <Float
      speed={2 * speed}
      rotationIntensity={1.5}
      floatIntensity={2}
      floatingRange={[-0.5, 0.5]}
    >
      <mesh ref={meshRef} position={position} scale={scale}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color={color}
          roughness={0.1}
          metalness={0.8}
          distort={0.3}
          speed={2}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
    </Float>
  );
}

// Floating Box with rotation
function FloatingBox({ position, color, scale = 1, speed = 1 }: { position: [number, number, number], color: string, scale?: number, speed?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2 * speed;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3 * speed;
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.1 * speed;
    }
  });

  return (
    <Float
      speed={1.5 * speed}
      rotationIntensity={2}
      floatIntensity={1.5}
      floatingRange={[-0.3, 0.3]}
    >
      <mesh ref={meshRef} position={position} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.9}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
    </Float>
  );
}

// Floating Torus
function FloatingTorus({ position, color, scale = 1, speed = 1 }: { position: [number, number, number], color: string, scale?: number, speed?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.25 * speed;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.35 * speed;
    }
  });

  return (
    <Float
      speed={1.8 * speed}
      rotationIntensity={1}
      floatIntensity={1.8}
      floatingRange={[-0.4, 0.4]}
    >
      <mesh ref={meshRef} position={position} scale={scale}>
        <torusGeometry args={[1, 0.3, 16, 100]} />
        <meshStandardMaterial
          color={color}
          roughness={0.1}
          metalness={1}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>
    </Float>
  );
}

// Particle Field
function ParticleField({ count = 50 }: { count?: number }) {
  // eslint-disable-next-line react-hooks/purity -- Math.random() is intentional for initial random positions
  const points = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return positions;
  }, [count]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={points}
          itemSize={3}
          args={[points, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#F07B3F"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Main Scene
function Scene() {
  return (
    <>
      {/* Ambient and directional lights */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#F07B3F" />
      <pointLight position={[10, -10, 5]} intensity={0.5} color="#FFD460" />

      {/* Floating shapes matching the warm theme */}
      <FloatingSphere position={[-4, 3, 0]} color="#F07B3F" scale={1.2} speed={0.8} />
      <FloatingSphere position={[5, -2, -2]} color="#EA5455" scale={0.9} speed={1.2} />
      <FloatingSphere position={[3, 4, -1]} color="#FFD460" scale={0.7} speed={0.9} />
      
      <FloatingBox position={[-3, -3, 1]} color="#2D4059" scale={0.8} speed={1.1} />
      <FloatingBox position={[6, 1, -3]} color="#F07B3F" scale={0.6} speed={0.7} />
      <FloatingBox position={[-5, 0, -2]} color="#EA5455" scale={0.5} speed={1.3} />
      
      <FloatingTorus position={[0, 0, 0]} color="#FFD460" scale={0.8} speed={1} />
      <FloatingTorus position={[-4, -4, -1]} color="#F07B3F" scale={0.5} speed={0.8} />
      <FloatingTorus position={[3, -3, 2]} color="#2D4059" scale={0.6} speed={1.2} />

      {/* Particle field */}
      <ParticleField count={80} />
    </>
  );
}

// Main Component
export default function Hero3DAnimation() {
  return (
    <div className="absolute inset-0 -z-5 overflow-visible">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
