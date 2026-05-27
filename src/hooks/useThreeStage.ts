import { type RefObject, useEffect } from "react";
import * as THREE from "three";

export function useThreeStage(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0.1, 9);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const blue = new THREE.MeshBasicMaterial({
      color: 0x0072ce,
      transparent: true,
      opacity: 0.34,
    });
    const cyan = new THREE.MeshBasicMaterial({
      color: 0x59dfff,
      transparent: true,
      opacity: 0.22,
    });
    const whiteLine = new THREE.LineBasicMaterial({
      color: 0xf6f8ff,
      transparent: true,
      opacity: 0.5,
    });
    const accentLine = new THREE.LineBasicMaterial({
      color: 0x57e6ff,
      transparent: true,
      opacity: 0.55,
    });

    for (let index = 0; index < 6; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.15 + index * 0.45, 0.008, 8, 180),
        index % 2 === 0 ? blue : cyan,
      );
      ring.rotation.x = Math.PI * 0.52 + index * 0.03;
      ring.rotation.z = index * 0.28;
      group.add(ring);
    }

    const grid = new THREE.Group();
    const gridSize = 4.8;
    for (let i = -4; i <= 4; i += 1) {
      const vertical = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i * 0.6, -gridSize, -0.7),
        new THREE.Vector3(i * 0.6, gridSize, -0.7),
      ]);
      const horizontal = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-gridSize, i * 0.6, -0.7),
        new THREE.Vector3(gridSize, i * 0.6, -0.7),
      ]);
      grid.add(new THREE.Line(vertical, whiteLine));
      grid.add(new THREE.Line(horizontal, whiteLine));
    }
    grid.rotation.x = Math.PI * 0.46;
    grid.position.y = -1.1;
    group.add(grid);

    const symbolGroup = new THREE.Group();
    group.add(symbolGroup);

    const makeLine = (
      points: Array<[number, number]>,
      material: THREE.LineBasicMaterial,
    ) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      );
      return new THREE.Line(geometry, material);
    };

    const square = makeLine(
      [
        [-0.25, -0.25],
        [0.25, -0.25],
        [0.25, 0.25],
        [-0.25, 0.25],
        [-0.25, -0.25],
      ],
      accentLine,
    );
    square.position.set(-3.15, 1.35, 0.35);
    symbolGroup.add(square);

    const triangle = makeLine(
      [
        [0, 0.32],
        [0.31, -0.23],
        [-0.31, -0.23],
        [0, 0.32],
      ],
      whiteLine,
    );
    triangle.position.set(3.1, 1.05, 0.2);
    symbolGroup.add(triangle);

    const cross = new THREE.Group();
    cross.add(
      makeLine(
        [
          [-0.28, -0.28],
          [0.28, 0.28],
        ],
        accentLine,
      ),
    );
    cross.add(
      makeLine(
        [
          [0.28, -0.28],
          [-0.28, 0.28],
        ],
        accentLine,
      ),
    );
    cross.position.set(-2.55, -1.45, 0.4);
    symbolGroup.add(cross);

    const circle = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.01, 8, 80),
      cyan,
    );
    circle.position.set(2.65, -1.65, 0.35);
    symbolGroup.add(circle);

    let frameId = 0;
    let targetX = 0;
    let targetY = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const pointer = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const animate = () => {
      const time = performance.now() * 0.001;
      group.rotation.y += (targetX * 0.16 - group.rotation.y) * 0.035;
      group.rotation.x += (-targetY * 0.08 - group.rotation.x) * 0.035;
      symbolGroup.rotation.z = Math.sin(time * 0.7) * 0.05;
      symbolGroup.children.forEach((child, index) => {
        child.rotation.z = time * (index % 2 === 0 ? 0.18 : -0.14);
      });
      grid.position.z = Math.sin(time * 0.8) * 0.08 - 0.6;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    animate();

    window.addEventListener("resize", resize);
    container.addEventListener("pointermove", pointer);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      container.removeEventListener("pointermove", pointer);
      scene.traverse((object) => {
        const disposable = object as THREE.Object3D & {
          geometry?: { dispose: () => void };
          material?: THREE.Material | THREE.Material[];
        };

        disposable.geometry?.dispose();

        if (disposable.material) {
          const material = disposable.material;
          if (Array.isArray(material)) {
            material.forEach((entry) => entry.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [containerRef, enabled]);
}
