"use client";

import * as React from "react";
import type { FenceShape, Dimensions } from "@/app/orcamentos/cerca-eletrica/page";
import type { PostCounts } from "@/lib/data";
import { calculateFenceVisuals } from "./fence-calculator";
import type { FenceSegmentCalculation } from "./fence-calculator";
import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";

type FenceVisualizerProps = {
  shape: FenceShape;
  dimensions: Dimensions;
  segments: number[];
  interactive?: boolean;
  onCountsChange?: (counts: PostCounts) => void;
  additionalPosts?: number;
};

type Post = {
  x: number;
  y: number;
  type: 'corner' | 'passage' | 'w';
};

export const postColors = {
    corner: { fill: 'hsl(220, 48%, 48%)', side: 'hsl(220, 48%, 38%)' }, // blue
    passage: { fill: 'hsl(54, 91%, 56%)', side: 'hsl(54, 91%, 46%)' }, // yellow
    w: { fill: 'hsl(142, 71%, 45%)', side: 'hsl(142, 71%, 35%)' }, // green
    additional: { fill: 'hsl(347, 77%, 50%)', side: 'hsl(347, 77%, 40%)' }, // pink
}

const FenceVisualizer = React.memo(function FenceVisualizer({ shape, dimensions, segments: realSegments, interactive = true, onCountsChange, additionalPosts = 0 }: FenceVisualizerProps) {
  
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 100, height: 75 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const visualData = useMemo(() => {
    const postCalcs: FenceSegmentCalculation[] = calculateFenceVisuals(realSegments);

    if (!dimensions || postCalcs.length === 0 || realSegments.length === 0 || realSegments.every(s => s === 0)) {
      return { posts: [], segments: [], viewBox: "0 0 100 75", initialViewBox: { x: 0, y: 0, width: 100, height: 75 }, passageSpacing: 0, wSpacing: 0 };
    }

    let shapePoints: {x: number, y: number}[] = [];
    
    switch(shape) {
        case 'linear':
            shapePoints = [
                {x: 0, y: 0},
                {x: dimensions.linear_length || 0, y: 0}
            ];
            break;
        case 'l-shape':
            shapePoints = [
                {x: 0, y: dimensions.l_sideA || 0}, 
                {x: 0, y: 0}, 
                {x: dimensions.l_sideB || 0, y: 0}
            ];
            break;
        case 'u-shape':
            const uSideA = dimensions.u_sideA || 0;
            const uSideB = dimensions.u_sideB || 0;
            const uSideC = dimensions.u_sideC || 0;
            shapePoints = [
                {x: 0, y: uSideA},
                {x: 0, y: 0},
                {x: uSideB, y: 0},
                {x: uSideB, y: uSideC}
            ];
            break;
        case 'quadrilateral':
            const quadSideA = dimensions.l_sideA || 0;
            const quadSideB = dimensions.l_sideB || 0;
            shapePoints = [
                {x: 0, y: 0},
                {x: quadSideA, y: 0},
                {x: quadSideA, y: quadSideB},
                {x: 0, y: quadSideB},
                {x: 0, y: 0},
            ];
            break;
       case 'free-draw':
            const freeDrawPoints = dimensions.points || [];
            if (freeDrawPoints.length > 1) {
                shapePoints = freeDrawPoints.map(p => ({ x: p.x / 10, y: p.y / 10}));
            }
        break;
    }
    
    if (shapePoints.length === 0) {
      return { posts: [], segments: [], viewBox: "0 0 100 75", initialViewBox: { x: 0, y: 0, width: 100, height: 75 }, passageSpacing: 0, wSpacing: 0 };
    }

    const allDrawablePoints = shapePoints;
    const uniqueShapePoints = Array.from(new Map(allDrawablePoints.map(p => [`${p.x},${p.y}`, p])).values());

    const allUnitX = uniqueShapePoints.length > 0 ? uniqueShapePoints.map(p => p.x) : [0];
    const allUnitY = uniqueShapePoints.length > 0 ? uniqueShapePoints.map(p => p.y) : [0];
    const minX = Math.min(...allUnitX);
    const maxX = Math.max(...allUnitX);
    const minY = Math.min(...allUnitY);
    const maxY = Math.max(...allUnitY);

    const toIso = (x: number, y: number) => {
        switch (rotation % 4) {
            case 0: return { isoX: (x - y), isoY: (x + y) / 2 };
            case 1: return { isoX: (x + y), isoY: (-x + y) / 2 };
            case 2: return { isoX: (-x + y), isoY: (-x - y) / 2 };
            case 3: return { isoX: (-x - y), isoY: (x - y) / 2 };
            default: return { isoX: (x - y), isoY: (x + y) / 2 };
        }
    };
    
    const isoPoints = uniqueShapePoints.map(p => toIso(p.x, p.y));
    const allIsoX = isoPoints.length > 0 ? isoPoints.map(p => p.isoX) : [0];
    const allIsoY = isoPoints.length > 0 ? isoPoints.map(p => p.isoY) : [0];

    const POST_HEIGHT = 5;
    const minIsoX = Math.min(...allIsoX);
    const maxIsoX = Math.max(...allIsoX);
    const minIsoY = Math.min(...allIsoY);
    const maxIsoY = Math.max(...allIsoY) + POST_HEIGHT;

    const isoWidth = (maxIsoX - minIsoX) || 1;
    const isoHeight = (maxIsoY - minIsoY) || 1;
    
    const viewBoxWidth = 100;
    const viewBoxHeight = 75;
    const padding = 15;

    const scale = Math.min((viewBoxWidth - 2 * padding) / isoWidth, (viewBoxHeight - 2 * padding) / isoHeight);

    const offsetX = (viewBoxWidth - isoWidth * scale) / 2 - minIsoX * scale;
    const offsetY = (viewBoxHeight - isoHeight * scale) / 2 - minIsoY * scale;

    const finalSegments: { start: {x:number, y:number}, end: {x:number, y:number}, length: number }[] = [];
    const finalPosts: Post[] = [];

    let passageSpacing = 0;
    let wSpacing = 0;

    let currentSegmentIndex = 0;
    
    const loopLength = shapePoints.length - 1;
    
    for (let i = 0; i < loopLength; i++) {
        const p1 = shapePoints[i];
        const p2 = shapePoints[(i + 1)];
        
        if (!p1 || !p2 || !realSegments[currentSegmentIndex]) {
            currentSegmentIndex++;
            continue;
        };

        const segmentLength = realSegments[currentSegmentIndex];
        const segmentCalc = postCalcs[currentSegmentIndex];
        

        if (!segmentCalc) {
          currentSegmentIndex++;
          continue;
        };

        if (segmentCalc.mainSpanLength > 0) passageSpacing = segmentCalc.mainSpanLength;
        if (segmentCalc.wSpanLength > 0) wSpacing = segmentCalc.wSpanLength;

        finalSegments.push({ start: p1, end: p2, length: segmentLength });
        
        finalPosts.push({ x: p1.x, y: p1.y, type: 'corner'});
        if (i === loopLength - 1 && shape !== 'quadrilateral') {
             finalPosts.push({ x: p2.x, y: p2.y, type: 'corner'});
        }
        
        const wPostsForSegment = segmentCalc.wPosts;
        const passagePostsForSegment = segmentCalc.passagePosts;
        const totalIntermediatePosts = wPostsForSegment + passagePostsForSegment;
        
        if (totalIntermediatePosts > 0) {
            const passageIndices = new Set<number>();
            if (passagePostsForSegment > 0) {
                const sectionLength = (totalIntermediatePosts + 1) / (passagePostsForSegment + 1);
                for(let j = 0; j < passagePostsForSegment; j++) {
                    passageIndices.add(Math.round(sectionLength * (j + 1)) - 1);
                }
            }
        
            for (let j = 0; j < totalIntermediatePosts; j++) {
                const fraction = (j + 1) / (totalIntermediatePosts + 1);
                const x = p1.x + (p2.x - p1.x) * fraction;
                const y = p1.y + (p2.y - p1.y) * fraction;
                finalPosts.push({ x, y, type: passageIndices.has(j) ? 'passage' : 'w' });
            }
        }
        currentSegmentIndex++;
    }


    const uniquePostsMap = new Map<string, Post>();
    finalPosts.forEach(p => {
      const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      const existing = uniquePostsMap.get(key);
      if (!existing || (p.type === 'corner' && existing.type !== 'corner') ) {
          uniquePostsMap.set(key, p);
      } else if (p.type === 'passage' && existing.type === 'w') {
          uniquePostsMap.set(key, p);
      }
    });

    const finalData = { 
      posts: Array.from(uniquePostsMap.values()).map(p => {
        const iso = toIso(p.x, p.y);
        return {
          ...p,
          isoX: iso.isoX * scale + offsetX,
          isoY: iso.isoY * scale + offsetY,
        }
      }),
      segments: finalSegments.map(s => {
        const startIso = toIso(s.start.x, s.start.y);
        const endIso = toIso(s.end.x, s.end.y);
        return {
          ...s,
          start: { isoX: startIso.isoX * scale + offsetX, isoY: startIso.isoY * scale + offsetY },
          end: { isoX: endIso.isoX * scale + offsetX, isoY: endIso.isoY * scale + offsetY },
        }
      }),
      initialViewBox: { x: 0, y: 0, width: viewBoxWidth, height: viewBoxHeight },
      passageSpacing,
      wSpacing
    };
    return finalData;
  }, [shape, dimensions, realSegments, rotation]);

  useEffect(() => {
    setViewBox(visualData.initialViewBox || { x: 0, y: 0, width: 100, height: 75 });
  }, [visualData.initialViewBox]);

  const postCounts = useMemo(() => {
    const counts: PostCounts = { corner: 0, passage: 0, w: 0, passageSpacing: 0, wSpacing: 0 };
    
    visualData.posts.forEach(p => {
      counts[p.type]++;
    });

    return counts;
  }, [visualData.posts]);

  // Use a ref to track previous counts and spacing to avoid unnecessary onCountsChange calls
  const prevCountsRef = useRef<string>("");

  useEffect(() => {
    if (onCountsChange) {
        const currentData = {
            ...postCounts,
            passageSpacing: visualData.passageSpacing,
            wSpacing: visualData.wSpacing,
        };
        const dataString = JSON.stringify(currentData);
        
        if (dataString !== prevCountsRef.current) {
            onCountsChange(currentData);
            prevCountsRef.current = dataString;
        }
    }
  }, [postCounts, visualData.passageSpacing, visualData.wSpacing, onCountsChange]);


  // --- Pan and Zoom Handlers ---
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const scaleFactor = e.deltaY > 0 ? 1.1 : 1 / 1.1; // Zoom out or in
    handleZoom(scaleFactor, e.clientX, e.clientY);
  };
  
  const handleZoom = (scaleFactor: number, clientX?: number, clientY?: number) => {
    if (!interactive) return;
    setViewBox(prev => {
        const newWidth = prev.width * scaleFactor;
        const newHeight = prev.height * scaleFactor;

        if (svgRef.current && clientX !== undefined && clientY !== undefined) {
          const svg = svgRef.current;
          const point = svg.createSVGPoint();
          point.x = clientX;
          point.y = clientY;

          const ctm = svg.getScreenCTM()?.inverse();
          if (!ctm) return prev;
          
          const { x: pointerX, y: pointerY } = point.matrixTransform(ctm);

          const newX = pointerX - (pointerX - prev.x) * scaleFactor;
          const newY = pointerY - (pointerY - prev.y) * scaleFactor;
          
          return { x: newX, y: newY, width: newWidth, height: newHeight };
        } else {
            const centerX = prev.x + prev.width / 2;
            const centerY = prev.y + prev.height / 2;
            return {
                x: centerX - newWidth / 2,
                y: centerY - newHeight / 2,
                width: newWidth,
                height: newHeight,
            };
        }
    });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    setIsPanning(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !interactive) return;
    e.preventDefault();

    const scaleX = viewBox.width / (svgRef.current?.clientWidth || 1);
    const scaleY = viewBox.height / (svgRef.current?.clientHeight || 1);

    const dx = (e.clientX - startPoint.x) * scaleX;
    const dy = (e.clientY - startPoint.y) * scaleY;
    
    setViewBox(prev => ({
      ...prev,
      x: prev.x - dx,
      y: prev.y - dy,
    }));
    setStartPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!interactive) return;
    setIsPanning(false);
  };
  
  const ZoomControls = () => (
     <div className="absolute bottom-2 right-2 flex gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleZoom(1 / 1.2)}>
            <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleZoom(1.2)}>
            <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRotation(r => r + 1)}>
            <RotateCw className="w-4 h-4" />
        </Button>
    </div>
  );


  const renderShapeAndPosts = () => {
    if (!visualData.segments || visualData.segments.length === 0) return null;

    const POST_WIDTH = 0.2;
    const POST_HEIGHT = 5;

    const wireTop = POST_HEIGHT * 0.85;
    const wireBottom = POST_HEIGHT * 0.15;
    const wireRange = wireTop - wireBottom;
    const wireSpacing = wireRange / 5;

    const toIso = (x: number, y: number, z: number) => {
        const angle = rotation % 4;
        let isoX, isoY;
        if (angle === 0) { isoX = x - y; isoY = (x + y) / 2; }
        else if (angle === 1) { isoX = x + y; isoY = (-x + y) / 2; }
        else if (angle === 2) { isoX = -x + y; isoY = (-x - y) / 2; }
        else { isoX = -x - y; isoY = (x - y) / 2; }
        return { isoX, isoY: isoY - z, z: (x+y) };
    };
    
    const renderPostBase = (type: Post['type']) => {
      const color = postColors[type];
      const R = POST_WIDTH / 2;
      const H = POST_HEIGHT;
      const points = [
          {x: -R, y: -R, z: 0}, {x: R, y: -R, z: 0}, {x: R, y: R, z: 0}, {x: -R, y: R, z: 0},
          {x: -R, y: -R, z: H}, {x: R, y: -R, z: H}, {x: R, y: R, z: H}, {x: -R, y: R, z: H}
      ];

      const isoPostPoints = points.map(p => toIso(p.x, p.y, p.z));
      const p = (idx: number) => `${isoPostPoints[idx].isoX},${isoPostPoints[idx].isoY}`;

      const faces = [];
      const angle = (rotation % 4);
      
      const fillUrl = `url(#${type}FillGradient)`;
      const sideUrl = `url(#${type}SideGradient)`;

      if (angle === 0) {
          faces.push(<path key="face-1" d={`M ${p(0)} L ${p(1)} L ${p(5)} L ${p(4)} Z`} fill={sideUrl} stroke={color.fill} strokeWidth="0.05" />);
          faces.push(<path key="face-2" d={`M ${p(1)} L ${p(2)} L ${p(6)} L ${p(5)} Z`} fill={fillUrl} stroke={color.side} strokeWidth="0.05" />);
      } else if (angle === 1) {
            faces.push(<path key="face-1" d={`M ${p(2)} L ${p(3)} L ${p(7)} L ${p(6)} Z`} fill={sideUrl} stroke={color.fill} strokeWidth="0.05" />);
            faces.push(<path key="face-2" d={`M ${p(1)} L ${p(2)} L ${p(6)} L ${p(5)} Z`} fill={fillUrl} stroke={color.side} strokeWidth="0.05" />);
      } else if (angle === 2) {
          faces.push(<path key="face-1" d={`M ${p(2)} L ${p(3)} L ${p(7)} L ${p(6)} Z`} fill={fillUrl} stroke={color.side} strokeWidth="0.05" />);
          faces.push(<path key="face-2" d={`M ${p(3)} L ${p(0)} L ${p(4)} L ${p(7)} Z`} fill={sideUrl} stroke={color.fill} strokeWidth="0.05" />);
      } else {
          faces.push(<path key="face-1" d={`M ${p(0)} L ${p(1)} L ${p(5)} L ${p(4)} Z`} fill={fillUrl} stroke={color.side} strokeWidth="0.05" />);
          faces.push(<path key="face-2" d={`M ${p(3)} L ${p(0)} L ${p(4)} L ${p(7)} Z`} fill={sideUrl} stroke={color.fill} strokeWidth="0.05" />);
      }
      
      faces.push(<path key="face-top" d={`M ${p(4)} L ${p(5)} L ${p(6)} L ${p(7)} Z`} fill={fillUrl} stroke={color.side} strokeWidth="0.05" />);
      return <g key="post-base">{faces}</g>;
    };
    
    const renderInsulators = (type: Post['type']) => {
      const insulators = [];
      const angle = (rotation % 4);
      
      for (let i = 0; i < 6; i++) {
        const z = wireTop - wireSpacing * i;

        if(type === 'w') {
          const base_d = 0.1;
          const hook_d = 0.2;
          const hook_h = 0.15;
          const insulatorColor = "#222";

          const renderWFace = (x:number, y:number, key: string) => {
            const base_p1 = toIso(x, y, z + hook_h);
            const base_p2 = toIso(x, y, z - hook_h);
            const hook_p1 = toIso(x + hook_d, y, z + hook_h/2);
            const hook_p2 = toIso(x + hook_d, y, z - hook_h/2);
            return (
              <g key={key}>
                <path d={`M ${base_p1.isoX},${base_p1.isoY} L ${base_p2.isoX},${base_p2.isoY}`} stroke={insulatorColor} strokeWidth="0.1"/>
                <path d={`M ${hook_p1.isoX},${hook_p1.isoY} L ${hook_p2.isoX},${hook_p2.isoY}`} stroke={insulatorColor} strokeWidth="0.1"/>
                <path d={`M ${base_p1.isoX},${base_p1.isoY} L ${hook_p1.isoX},${hook_p1.isoY}`} stroke={insulatorColor} strokeWidth="0.1"/>
                <path d={`M ${base_p2.isoX},${base_p2.isoY} L ${hook_p2.isoX},${hook_p2.isoY}`} stroke={insulatorColor} strokeWidth="0.1"/>
              </g>
            );
          }

          if (angle === 0 || angle === 3) insulators.push(renderWFace(-POST_WIDTH/2 - base_d, 0, `ins-w-left-${i}`));
          if (angle === 0 || angle === 1) insulators.push(renderWFace(0, POST_WIDTH/2 + base_d, `ins-w-front-${i}`));
          if (angle === 1 || angle === 2) insulators.push(renderWFace(POST_WIDTH/2 + base_d, 0, `ins-w-right-${i}`));
          if (angle === 2 || angle === 3) insulators.push(renderWFace(0, -POST_WIDTH/2 - base_d, `ins-w-back-${i}`));
        
        } else { // Corner or Passage (Tensioner)
          const hook_d = 0.4;
          const ins_l = 0.3;
          const ins_w = 0.2;
          
          const renderTensioner = (x:number, y:number, key: string) => {
            const hook_end = toIso(x,y,z);
            const hook_start = toIso(x/2, y/2, z);

             return (
              <g key={key}>
                <line x1={hook_start.isoX} y1={hook_start.isoY} x2={hook_end.isoX} y2={hook_end.isoY} stroke="#aaa" strokeWidth={0.1} />
                <ellipse cx={hook_end.isoX} cy={hook_end.isoY} rx={ins_l/2} ry={ins_w/2} fill="#222" stroke="#111" strokeWidth={0.05} />
              </g>
            );
          }
          
          if(type === 'corner') {
            if (angle === 0 || angle === 3) insulators.push(renderTensioner(-hook_d, 0, `ins-c-1-${i}`));
            if (angle === 0 || angle === 1) insulators.push(renderTensioner(0, hook_d, `ins-c-2-${i}`));
            if (angle === 1 || angle === 2) insulators.push(renderTensioner(hook_d, 0, `ins-c-3-${i}`));
            if (angle === 2 || angle === 3) insulators.push(renderTensioner(0, -hook_d, `ins-c-4-${i}`));
          } else { // passage
             insulators.push(renderTensioner(hook_d, 0, `ins-p1-${i}`));
             insulators.push(renderTensioner(-hook_d, 0, `ins-p2-${i}`));
          }
        }
      }
      return <g key="insulators">{insulators}</g>;
    };

    const renderPost = (post: typeof visualData.posts[0]) => {
        const { isoX, isoY, type } = post;
        
        return(
            <g key={`post-${isoX}-${isoY}`} transform={`translate(${isoX}, ${isoY})`} style={{ filter: 'url(#shadow)'}}>
               {renderPostBase(type)}
               {renderInsulators(type)}
            </g>
        );
    };

    const renderWall = (seg: typeof visualData.segments[0], index: number) => {
        const { start, end } = seg;
        const p0 = {x: start.isoX, y: start.isoY};
        const p1 = {x: end.isoX, y: end.isoY};
        return <line key={`wall-${index}`} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.2" />;
    };
    
    const renderWiresForSegment = (seg: typeof visualData.segments[0], index: number) => {
        const segmentPosts = visualData.posts.filter(p => {
             const dx = seg.end.isoX - seg.start.isoX;
             const dy = seg.end.isoY - seg.start.isoY;
             const segLenSq = dx * dx + dy * dy;

             if (segLenSq === 0) return false;

             const t = ((p.isoX - seg.start.isoX) * dx + (p.isoY - seg.start.isoY) * dy) / segLenSq;
             if (t < -0.01 || t > 1.01) return false;

             const closestX = seg.start.isoX + t * dx;
             const closestY = seg.start.isoY + t * dy;
             const distSq = (p.isoX - closestX) * (p.isoX - closestX) + (p.isoY - closestY) * (p.isoY - closestY);

             return distSq < 0.1; 
        }).sort((a,b) => {
            const da = (a.isoX - seg.start.isoX) ** 2 + (a.isoY - seg.start.isoY) ** 2;
            const db = (b.isoX - seg.start.isoX) ** 2 + (b.isoY - seg.start.isoY) ** 2;
            return da - db;
        });

        const wires = [];
        for (let i = 0; i < segmentPosts.length - 1; i++) {
            const post1 = segmentPosts[i];
            const post2 = segmentPosts[i+1];

            for (let j = 0; j < 6; j++) {
                const z = wireTop - wireSpacing * j;
                const startWire = toIso(0,0,z);
                
                wires.push(
                    <line
                        key={`wire-${index}-${i}-${j}`}
                        x1={post1.isoX + startWire.isoX}
                        y1={post1.isoY + startWire.isoY}
                        x2={post2.isoX + startWire.isoX}
                        y2={post2.isoY + startWire.isoY}
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth="0.1"
                    />
                )
            }
        }
        return wires;
    }


    const allElements = [
        ...visualData.segments.map((seg, i) => ({ key: `wall-${i}`, type: 'wall', element: renderWall(seg, i), y: (seg.start.isoY + seg.end.isoY) / 2, x: (seg.start.isoX + seg.end.isoX) / 2, z: (seg.start.isoX - seg.start.isoY) + (seg.end.isoX-seg.end.isoY) })),
        ...visualData.posts.map((post, i) => ({ key: `post-${i}`, type: 'post', element: renderPost(post), y: post.isoY, x: post.isoX, z: (post.isoX - post.isoY) })),
        ...visualData.segments.flatMap((seg, i) => 
            renderWiresForSegment(seg, i).map((wire, j) => ({
                key: `wire-${i}-${j}`,
                type: 'wire',
                element: wire,
                y: (seg.start.isoY + seg.end.isoY) / 2,
                x: (seg.start.isoX + seg.end.isoX) / 2,
                z: (seg.start.isoX - seg.start.isoY) + (seg.end.isoX-seg.end.isoY)
            }))
        )
    ].sort((a,b) => (a.y + a.x*0.01) - (b.y + b.x*0.01));


    return (
        <svg 
            ref={svgRef}
            width="100%" 
            height="100%" 
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            className={`max-h-full ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
             <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.5" floodColor="hsl(var(--muted-foreground))" floodOpacity="0.3"/>
                </filter>
                 {Object.entries(postColors).map(([key, { fill, side }]) => (
                    <React.Fragment key={key}>
                        <linearGradient id={`${key}FillGradient`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={fill} stopOpacity={0.8} />
                            <stop offset="50%" stopColor={fill} stopOpacity={1} />
                            <stop offset="100%" stopColor={fill} stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id={`${key}SideGradient`} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={side} stopOpacity={0.8} />
                            <stop offset="50%" stopColor={side} stopOpacity={1} />
                            <stop offset="100%" stopColor={side} stopOpacity={0.8} />
                        </linearGradient>
                    </React.Fragment>
                ))}
            </defs>

            {allElements.map(e => <React.Fragment key={e.key}>{e.element}</React.Fragment>)}
            
            {visualData.segments.map((seg, i) => {
                const midX = (seg.start.isoX + seg.end.isoX) / 2;
                const midY = (seg.start.isoY + seg.end.isoY) / 2;
                let angle = Math.atan2(seg.end.isoY - seg.start.isoY, seg.end.isoX - seg.start.isoX) * (180 / Math.PI);
                
                if (angle > 90 || angle < -90) {
                    angle += 180;
                }

                const textOffset = -3;
                
                return (
                    <text
                        key={`label-${i}`}
                        x={midX}
                        y={midY + textOffset}
                        transform={`rotate(${angle}, ${midX}, ${midY})`}
                        textAnchor="middle"
                        fontSize={1.2}
                        fill="hsl(var(--foreground))"
                        className="font-semibold"
                    >
                       {`${seg.length.toFixed(1).replace('.', ',')}m`}
                    </text>
                );
            })}
        </svg>
    );
  };

  const initialContent = (
     <div className="flex-1 flex items-center justify-center min-h-[300px] h-full">
        <p className="text-muted-foreground text-center p-4">
            Selecione um formato e insira as dimensões para ver a simulação detalhada das hastes.
        </p>
     </div>
  );

  const mainContent = realSegments.length > 0 ? renderShapeAndPosts() : initialContent;

  const Legend = () => (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-2 p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{backgroundColor: postColors.corner.fill}} />
            <span className="text-xs font-medium">Haste Castanha: <b className="text-primary">{postCounts.corner || 0}</b></span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{backgroundColor: postColors.passage.fill}} />
            <span className="text-xs font-medium">Haste Passagem: <b className="text-primary">{postCounts.passage || 0}</b></span>
            {postCounts.passage > 0 && <span className="text-[10px] text-muted-foreground font-semibold">({visualData.passageSpacing.toFixed(2)}m)</span>}
        </div>
         <div className="flex items-center gap-2 whitespace-nowrap">
            <div className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{backgroundColor: postColors.w.fill}} />
            <span className="text-xs font-medium">Haste Tipo W: <b className="text-primary">{postCounts.w || 0}</b></span>
            {postCounts.w > 0 && <span className="text-[10px] text-muted-foreground font-semibold">({visualData.wSpacing.toFixed(2)}m)</span>}
        </div>
        {additionalPosts > 0 && (
          <div className="flex items-center gap-2 whitespace-nowrap border-l pl-4 border-muted-foreground/20">
            <div className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{backgroundColor: postColors.additional.fill}} />
            <span className="text-xs font-medium">Hastes Adicionais: <b className="text-primary">{additionalPosts}</b></span>
          </div>
        )}
    </div>
  );

  if (!interactive) {
     return (
        <div className="flex flex-col h-full">
            {realSegments.length > 0 && <Legend />}
            <div className="flex-1 h-full relative">
                {mainContent}
            </div>
        </div>
     );
  }
  
  return (
      <div className="flex flex-col h-full w-full">
        {interactive && realSegments.length > 0 && <Legend />}
        <div className="w-full h-full relative border rounded-md overflow-hidden bg-card">
             {mainContent}
             <ZoomControls />
        </div>
      </div>
  );
});

export default FenceVisualizer;
